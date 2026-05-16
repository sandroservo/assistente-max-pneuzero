/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Picker simples de emoji — grid fixo dos mais comuns. Sem libs externas.
 */

"use client";

const EMOJIS = [
  "😀", "😂", "🙂", "😉", "😍", "😎", "🤔", "😅",
  "😢", "😡", "👍", "👎", "👏", "🙏", "🔥", "💯",
  "✅", "❌", "⚠️", "❓", "❗", "🎉", "🚀", "💪",
  "❤️", "💔", "👀", "💬", "📢", "🛞", "🚗", "🛠️",
];

export function EmojiPicker({ onPick, onClose }: { onPick: (e: string) => void; onClose: () => void }) {
  return (
    <div
      className="absolute bottom-14 left-2 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-2 grid grid-cols-8 gap-1"
      onMouseLeave={onClose}
    >
      {EMOJIS.map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => {
            onPick(e);
            onClose();
          }}
          className="text-xl hover:bg-gray-100 rounded p-1 transition"
        >
          {e}
        </button>
      ))}
    </div>
  );
}
