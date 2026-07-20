# Lightbox / Media Preview — Design Spec

Portable spec for **full-size photo / media preview** in EMZI Nexus Brain. Lightboxes stack above dialogs and sheets; opening or closing a photo must **never** dismiss an underlying modal form or other overlay.

**Reference implementation:**

| File | Purpose |
|------|---------|
| `frontend/src/components/media/MediaLightbox.jsx` | Shared portal shell (backdrop, close, Escape, scroll lock) |
| `frontend/src/components/media/LightboxStackContext.jsx` | Open-count context so Dialog/Sheet ignore dismiss while lightbox is open |
| `frontend/src/components/feed/PostImageGrid.jsx` | Feed multi-image gallery lightbox |
| `frontend/src/components/attendance/AttendancePhotoViewer.jsx` | Attendance photo lightbox |
| `frontend/src/components/profile/ProfileMediaViewer.jsx` | Profile avatar / cover viewer + comments |
| `frontend/src/components/ui/dialog.jsx` | Dialog dismiss guards while lightbox open |
| `frontend/src/components/ui/sheet.jsx` | Sheet dismiss guards while lightbox open |
| `docs/DESIGN_TEMPLATE.md` §5 | Z-index layer map |

---

## 1. Goals

1. **Full-size preview** — show the original (or highest available) image without cropping away detail.
2. **Stack above chrome** — lightbox sits above Dialog / Sheet / Drawer (`z-50`), notification panel, and page content.
3. **Keep parents untouched** — opening a photo from an open modal form must leave that modal open with form state intact; closing the lightbox returns to the same modal.
4. **One shell** — all new photo viewers use `MediaLightbox`. Do not invent a parallel portal + Escape + body-lock pattern.
5. **Accessible** — `role="dialog"`, `aria-modal="true"`, labeled close control, Escape closes lightbox only.

---

## 2. Z-index & stacking

| z-index | Layer |
|---------|-------|
| `z-[130]` | SSO credential picker |
| `z-[120]` | Application launch overlay, mention autocomplete |
| **`z-[110]`** | **Lightbox / media preview** |
| `z-[100]` | Legacy toasts (Radix toast viewport) |
| `z-[61]` / `z-[60]` | Notification panel / backdrop |
| `z-50` | Dialogs, sheets, drawers, dropdowns |

**Rule:** Use `z-[110]` for every lightbox shell. Do not reuse `z-50` (collides with Dialog) or invent a one-off value without updating DESIGN_TEMPLATE §5 and this doc.

---

## 3. Visual shell

| Element | Spec |
|---------|------|
| Mount | `createPortal(…, document.body)` |
| Backdrop | `fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-8` (profile viewer may use `p-3 sm:p-6`) |
| Surface | `bg-black/80 backdrop-blur-md` |
| Enter | `animate-in fade-in-0 duration-200` |
| Close button | Ghost icon, `h-10 w-10 rounded-full`, `absolute right-3 top-3` (`sm:right-5 sm:top-5`), `text-white/90 hover:bg-white/10` |
| Image | `object-contain` + max height/width caps; `rounded-2xl shadow-2xl` for simple previews |
| Loading | Centered `Loader2` + short “Loading photo…” label in `text-white/80` |

Content clicks must `stopPropagation` so backdrop click does not close when interacting with the image or side panel.

---

## 4. Stacking invariant (keep parent overlays open)

While any lightbox is open:

| Parent | Required behavior |
|--------|-------------------|
| Dialog / AlertDialog | Stay open; form values preserved |
| Sheet / Drawer | Stay open |
| Notification panel / page | Untouched |

**How it works in code:**

1. `MediaLightbox` registers with `LightboxStackContext` while open.
2. `DialogContent` / `SheetContent` call `event.preventDefault()` on `onPointerDownOutside`, `onInteractOutside`, `onFocusOutside`, and `onEscapeKeyDown` when `isLightboxOpen` is true.
3. Escape is handled in **capture** phase on `window` with `stopImmediatePropagation` so only the lightbox closes.

**Do not** unmount or set `open={false}` on a parent Dialog when opening a photo.

Closing the lightbox (X, backdrop, Escape) must restore focus to a sensible place without closing the parent.

---

## 5. Keyboard & pointer

| Input | Behavior |
|-------|----------|
| Escape | Close lightbox only (capture + stop). Parent modal stays open. |
| Backdrop click | Close lightbox only. |
| Close button | Close lightbox; `stopPropagation` on the click. |
| ArrowLeft / ArrowRight | Previous / next image when the viewer is a multi-image gallery (`PostImageGrid`). |

Body scroll: lock `document.body.style.overflow` to `hidden` while open; restore the **previous** value on close (do not force `''` if a Dialog already locked scroll).

---

## 6. When to use which viewer

| Use case | Component |
|----------|-----------|
| Feed post attachments (1–N images) | `PostImageGrid` (uses `MediaLightbox`) |
| Attendance clock photo | `AttendancePhotoViewer` |
| Profile avatar / cover + reactions/comments | `ProfileMediaViewer` |
| New simple image preview | Compose with `MediaLightbox` directly |

Crop dialogs and composer thumbnails are **not** lightboxes unless explicitly wired; they keep the image for later full-size preview (see profile uploaders).

---

## 7. Pre-ship checklist

- [ ] Portal to `document.body` via `MediaLightbox` (or registers with `LightboxStackContext`)
- [ ] `z-[110]` — not `z-50` / not a one-off
- [ ] Escape closes lightbox only; parent Dialog/Sheet stays open
- [ ] Backdrop / outside pointer does not dismiss parent overlay
- [ ] Body overflow restored to previous value
- [ ] `aria-label` on shell and close button
- [ ] Image uses full URL via `toAbsoluteUrl` when needed (`lib/media.js`)

---

## 8. Copy-paste mental model

```
User opens photo from open modal
  → MediaLightbox portals at z-[110]
  → LightboxStackContext count += 1
  → Dialog/Sheet ignore outside + Escape dismiss
  → User closes lightbox
  → count -= 1
  → Modal still open with form state intact
```

---

*Last updated with MediaLightbox + LightboxStackContext. When lightbox patterns change in code, update this document and DESIGN_TEMPLATE §5.*
