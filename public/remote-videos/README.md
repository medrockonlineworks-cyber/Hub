# EthioHub Remote Videos (GitHub-Only Media Hosting)

Upload `.mp4`, `.webm`, or `.mov` videos directly into **`public/remote-videos/`** inside GitHub!

## Recommended Video Naming
Name your videos sequentially using natural names:
- `full video one.mp4`
- `full video two.mp4`
- `full video three.mp4`
- `full video four.mp4`

## Optional Matching Cover Images
To give a video its own custom thumbnail, upload an image with the **same base name** into **`public/remote-images/`**:
- `public/remote-images/full video one.jpg` (or `.png` / `.webp`) -> automatically pairs with `full video one.mp4`
- `public/remote-images/full video two.jpg` -> automatically pairs with `full video two.mp4`

## Automatic Sync (No APK Reinstall Needed)
1. Upload your video or image inside GitHub.
2. EthioHub automatically detects new and replaced files in `public/remote-videos/` and `public/remote-images/`, keeps them in numeric order (`Full Video One`, `Full Video Two`, ...), caches them locally on the device for offline playback, and updates `public/manifest.json` via GitHub Actions without rebuilding or reinstalling the APK.
