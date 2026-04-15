# Envicion Social Media Content Folder

This folder is managed by the Envicion OS app.
All generated content, scheduled posts, and reports are saved here automatically.

## Structure

```
social-content/
├── Calendar/
│   └── 2026/
│       ├── April/      ← monthly post schedules (JSON + CSV)
│       ├── May/
│       ├── June/
│       └── July/
├── Content/
│   ├── Instagram/      ← captions, hashtags, image prompts
│   ├── Facebook/
│   ├── LinkedIn/
│   ├── TikTok/
│   ├── YouTube/
│   └── RedNote/
├── Images/
│   ├── Drafts/         ← AI-generated image prompts pending creation
│   ├── Approved/       ← approved visuals ready to post
│   └── Published/      ← record of what was posted
├── Hashtags/           ← optimised hashtag sets per platform
└── Reports/
    ├── Weekly/         ← weekly performance summaries
    └── Monthly/        ← monthly analytics exports
```

## How it works

- **Autopilot** — generates content and saves it here automatically
- **Content Creator** — drafts are saved to Content/<Platform>/
- **Calendar** — scheduled posts exported as calendar-YYYY-MM.json
- **Reports** — analytics exported after each autopilot cycle

To copy this folder to your Desktop, run:
```bash
cp -r /Users/laichanchean/Desktop/Jobs/envision-os/social-content ~/Desktop/"Envicion Social Media"
```
