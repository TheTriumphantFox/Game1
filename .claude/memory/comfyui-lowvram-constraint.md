---
name: comfyui-lowvram-constraint
description: Before any ComfyUI work, remind the user to close ollama, since they share a 6GB GPU
metadata:
  type: feedback
---

**Remind the user to close ollama before starting any ComfyUI/image-generation work.** They asked
for this reminder explicitly (2026-08-25) and will shut it down themselves. Never kill or unload it
on their behalf, because it serves their local qwen worker.

**Why:** ComfyUI lives at `/home/hm/AI/ComfyUI`. The nested `ComfyUI/ComfyUI` subdir is **not** empty, so
do not dismiss this note when `ls` shows 44 entries there: it is a complete duplicate source
checkout, byte-identical `main.py` and all, whose `models/checkpoints/` holds only the
`put_checkpoints_here` placeholder. It has no models, so it is the wrong one; use the outer path. and shares a GTX 1660 SUPER with only 6GB VRAM.
Ollama typically holds ~4.3GB of it, leaving too little for SDXL. With ollama closed, the whole
card is free and generation is both faster and less fragile.

**How to apply:** at the start of a ComfyUI session, check with
`nvidia-smi --query-compute-apps=pid,process_name,used_memory --format=csv`. If ollama is holding
VRAM, say so and let the user close it before generating.

If work has to proceed with ollama still loaded, plain `VAEDecode` OOMs at 1024x1024 even though
sampling itself succeeds (decode requested 256MB with ~42MB free). Swap in `VAEDecodeTiled` with
`tile_size: 256, overlap: 64` and start the server with `--lowvram`. That works, at ~170s per
1024x1024 SDXL image at 30 steps. Only checkpoint installed: `RealVisXL_V5.0_fp16.safetensors`.

See [[triumphant-gaming-logo]].
