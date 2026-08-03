"""Convert a HuggingFace Whisper model to CTranslate2 format for faster-whisper.

Default source is a Kazakh/Russian fine-tuned large-v3-turbo model. Once this
script finishes, speech_transcriber.py picks up the converted model
automatically (it checks for models/whisper-kazrus-ct2).

Usage:
    python scripts/convert_whisper_model.py
    python scripts/convert_whisper_model.py --model abilmansplus/whisper-turbo-ksc2

Requires network access (downloads ~1.5 GB on first run) and ctranslate2's
transformers converter, which ships with the `ctranslate2` package.
"""
import argparse
import os

from ctranslate2.converters import TransformersConverter

DEFAULT_MODEL = "abilmansplus/whisper-turbo-kaz-rus-v1"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_OUT = os.path.join(ROOT, "models", "whisper-kazrus-ct2")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default=DEFAULT_MODEL,
                        help="HuggingFace model id or local path")
    parser.add_argument("--output_dir", default=DEFAULT_OUT)
    parser.add_argument("--quantization", default="int8",
                        help="int8 (CPU) or float16 (GPU). int8 also works on GPU.")
    args = parser.parse_args()

    print(f"Converting {args.model} -> {args.output_dir} ({args.quantization})...")
    converter = TransformersConverter(args.model)
    converter.convert(args.output_dir, quantization=args.quantization, force=True)
    print("Done. speech_transcriber.py will now use the fine-tuned model.")


if __name__ == "__main__":
    main()
