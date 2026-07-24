-- Adds a place to keep the raw audio recording from "Record my story," not
-- just its transcription — a submitter can record, preview, and download it
-- before deciding to use it; if they do, the recording itself is uploaded
-- and kept (reviewers can listen to the original alongside the transcript),
-- the same way an uploaded video is kept alongside its transcript.
--
-- Reuses the existing private story-videos bucket rather than adding a new
-- one (same access pattern: service-role upload, signed URL for playback) —
-- audio and video paths just live under different filenames/extensions.

alter table story_submissions add column if not exists audio_path text;
