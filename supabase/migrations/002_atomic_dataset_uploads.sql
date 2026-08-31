ALTER TABLE upersona_datasets
  ADD COLUMN IF NOT EXISTS active_upload_id TEXT NOT NULL DEFAULT 'legacy';

ALTER TABLE upersona_dataset_chunks
  ADD COLUMN IF NOT EXISTS upload_id TEXT NOT NULL DEFAULT 'legacy';

ALTER TABLE upersona_dataset_chunks
  DROP CONSTRAINT IF EXISTS upersona_dataset_chunks_dataset_id_chunk_index_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_upersona_dataset_chunk_upload
  ON upersona_dataset_chunks(dataset_id, upload_id, chunk_index);

CREATE INDEX IF NOT EXISTS idx_upersona_chunks_active_upload
  ON upersona_dataset_chunks(dataset_id, upload_id, chunk_index);
