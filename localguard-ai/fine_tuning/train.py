import torch
from unsloth import FastLanguageModel
from datasets import Dataset
from trl import SFTTrainer
from transformers import TrainingArguments

MAX_SEQ_LENGTH = 2048
MODEL_NAME = "unsloth/Qwen2.5-Coder-3B-Instruct"

print("[*] Loading base model into 4-bit VRAM...")
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name=MODEL_NAME,
    max_seq_length=MAX_SEQ_LENGTH,
    load_in_4bit=True,
)

model = FastLanguageModel.get_peft_model(
    model,
    r=16,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    lora_alpha=16,
    lora_dropout=0,
    bias="none",
    use_gradient_checkpointing="unsloth",
)

train_data = [
    {
        "instruction": "Audit code snippet for CWE vulnerabilities.",
        "input": "user_id = request.args.get('id')\ndb.execute(f'SELECT * FROM users WHERE id={user_id}')",
        "output": '{"vulnerable": true, "cwe": "CWE-89", "issue": "SQL Injection via unsafe string interpolation", "fix": "db.execute(\\"SELECT * FROM users WHERE id=%s\\", (user_id,))"}'
    }
]

def format_prompts(examples):
    texts = []
    for inst, inp, out in zip(examples["instruction"], examples["input"], examples["output"]):
        text = f"<|im_start|>system\nYou are a security auditor.<|im_end|>\n<|im_start|>user\n{inst}\n\nCode:\n```{inp}```<|im_end|>\n<|im_start|>assistant\n{out}<|im_end|>"
        texts.append(text)
    return {"text": texts}

dataset = Dataset.from_list(train_data).map(format_prompts, batched=True)

trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=dataset,
    dataset_text_field="text",
    max_seq_length=MAX_SEQ_LENGTH,
    args=TrainingArguments(
        per_device_train_batch_size=1,
        gradient_accumulation_steps=4,
        warmup_steps=2,
        max_steps=10,
        learning_rate=2e-4,
        fp16=not torch.cuda.is_bf16_supported(),
        logging_steps=1,
        output_dir="outputs",
    ),
)

print("[*] Training LoRA adapter...")
trainer.train()

print("[*] Exporting model to GGUF format for Ollama...")
model.save_pretrained_gguf("custom_sec_model", tokenizer, quantization_method="q4_k_m")
print("[✓] Model export completed!")