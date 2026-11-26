# EthioHub Remote Videos (GitHub-Only Media Hosting)

Upload `.mp4` or `.webm` video files into `public/remote-videos/` and register them in `public/manifest.json` under the `"videos"` array.

Example entry in `public/manifest.json`:

```json
{
  "id": "vid-midnight-tizita",
  "name": "midnight_tizita.mp4",
  "path": "public/remote-videos/midnight_tizita.mp4",
  "version": "1.0.0",
  "updatedAt": "2026-11-26T01:00:00Z",
  "mimeType": "video/mp4",
  "thumbnailId": "hero_ethiojazz_addis",
  "title": "Midnight Tizita: Live in Kazanchis",
  "description": "Recorded live in Addis Ababa.",
  "creatorId": "creator-selam",
  "category": "Music",
  "region": "Addis Ababa",
  "language": "Amharic · English CC",
  "durationSec": 320
}
```

- Using an existing catalog `id` (like `"vid-midnight-tizita"`) attaches the GitHub-hosted video stream directly to that catalog film.
- Using a new `id` automatically adds the video to the EthioHub catalog with zero app reinstallation.
- Bump `"version"` or `"updatedAt"` whenever you replace a video or image file so connected devices refresh only the changed asset.
