<?php

namespace App\Support;

/**
 * Quick reaction shortcuts shown in the feed pill vs the full collection allowlist.
 * Keep ALLOWED in sync with frontend/src/components/feed/EmojiCollectionPicker.jsx.
 */
final class ReactionEmojis
{
    /**
     * Default shortcuts returned as available_reactions on serialized items.
     *
     * @var list<string>
     */
    public const QUICK = ['👍', '❤️', '👏', '🎉', '😂', '🔥'];

    /**
     * All emojis that may be stored as a reaction (quick set + collection).
     *
     * @var list<string>
     */
    public const ALLOWED = [
        // Quick defaults
        '👍', '❤️', '👏', '🎉', '😂', '🔥',
        // Smileys
        '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😊', '😇', '🙂', '😉', '😍', '🥰', '😘', '😗', '😋', '😜', '🤪', '🤨', '🧐', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '😣', '😢', '😭', '😤', '😠', '🤯', '😳', '🥵', '🥶', '😱', '😨', '🤗', '🤔', '🤭', '🤫', '😶', '😐', '😑', '😬', '🙄', '😴', '🤤', '😷', '🤒', '🤕',
        // Gestures
        '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '🙌', '👐', '🤲', '🤝', '🙏', '💪', '🦾', '👋', '🤚', '🖐️', '✋', '🖖', '👈', '👉', '👆', '👇', '☝️', '👊', '✊', '🤛', '🤜', '💅', '🤳',
        // Hearts / symbols
        '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '❣️', '💔', '❤️‍🔥', '💯', '✨', '⭐', '🌟', '💫', '⚡', '💥',
        // Celebrate
        '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉', '🎖️', '🏅', '🎯', '🚀', '💡', '📌', '✅', '☑️', '✔️', '❗', '❓', '💬', '🗨️', '📢', '🔔',
        // Work
        '💼', '💻', '🖥️', '📱', '⌨️', '🖱️', '📊', '📈', '📉', '🧾', '📝', '📋', '📁', '📂', '🗓️', '📅', '⏰', '⌛', '📦', '✉️', '📧', '📞', '🛠️', '⚙️', '🔧', '📎', '🔗',
        // Food
        '☕', '🍵', '🧋', '🥤', '🍺', '🍻', '🥂', '🍷', '🍕', '🍔', '🍟', '🌮', '🍣', '🍜', '🥗', '🍰', '🍪', '🍩', '🍫', '🍎', '🍌', '🍓', '🥑', '🌶️',
    ];
}
