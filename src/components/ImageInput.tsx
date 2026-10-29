import React, { useRef, useState } from 'react';
import { Btn } from './ui';
import { compressImage, dataUrlBytes } from '../lib/images';
import { isValidUrl } from '../lib/utils';

export const ImageInput: React.FC<{
  imageUrl?: string;
  imageAlt?: string;
  onChange: (patch: { imageUrl?: string; imageAlt?: string }) => void;
  label?: string;
  compact?: boolean;
}> = ({ imageUrl, imageAlt, onChange, label = 'Question image', compact }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [urlDraft, setUrlDraft] = useState('');
  const [dragging, setDragging] = useState(false);

  const ingest = async (file: File) => {
    setError('');
    setBusy(true);
    try {
      const c = await compressImage(file, file.name);
      onChange({ imageUrl: c.dataUrl, imageAlt: imageAlt || file.name.replace(/\.[a-z]+$/i, '').replace(/[-_]/g, ' ') });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="label mb-1">{label}</span>
        {imageUrl && (
          <button
            type="button"
            className="text-xs font-bold text-red-600 hover:underline"
            onClick={() => onChange({ imageUrl: '', imageAlt: '' })}
          >
            Remove
          </button>
        )}
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file && file.type.startsWith('image/')) void ingest(file);
        }}
        className={`rounded-2xl border-2 border-dashed p-3 transition ${
          dragging ? 'border-teal-500 bg-teal-100/40' : 'border-navy-100 bg-cream-50'
        }`}
      >
        {imageUrl ? (
          <div className="flex flex-col gap-2">
            <img
              src={imageUrl}
              alt={imageAlt || 'Question image preview'}
              className="max-h-40 w-full rounded-xl object-contain bg-white"
            />
            <p className="text-[11px] text-navy-300">
              {imageUrl.startsWith('data:') ? `Compressed · ${Math.round(dataUrlBytes(imageUrl) / 1024)} KB` : 'Linked image'}
            </p>
          </div>
        ) : (
          <div className="py-3 text-center">
            <p className="text-sm font-bold text-navy-500">Drag an image here</p>
            <p className="text-xs text-navy-300 mt-0.5">PNG, JPG, GIF or WebP · auto-compressed to WebP</p>
          </div>
        )}

        <div className="mt-2 flex flex-wrap gap-2">
          <Btn
            type="button"
            size="sm"
            variant="ghost"
            loading={busy}
            onClick={() => inputRef.current?.click()}
          >
            📁 Upload
          </Btn>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void ingest(f);
              e.target.value = '';
            }}
          />
          <div className="flex flex-1 gap-1 min-w-[180px]">
            <input
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="Paste image URL"
              aria-label="Image URL"
              className="input !py-2 !min-h-[40px] text-sm flex-1"
            />
            <Btn
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                if (!isValidUrl(urlDraft)) {
                  setError('That does not look like a valid http(s) link.');
                  return;
                }
                onChange({ imageUrl: urlDraft.trim() });
                setUrlDraft('');
              }}
            >
              Use
            </Btn>
          </div>
        </div>
      </div>

      {imageUrl && (
        <div className="mt-2">
          <label className="label" htmlFor="alt-text">
            Alt text <span className="text-red-500">*</span>
          </label>
          <input
            id="alt-text"
            className="input text-sm"
            value={imageAlt ?? ''}
            onChange={(e) => onChange({ imageAlt: e.target.value })}
            placeholder="Describe the image for learners using a screen reader"
            maxLength={200}
          />
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-1 font-semibold">{error}</p>}
      {!compact && !imageUrl && (
        <p className="hint">Images help but are optional. Alt text is required whenever an image is used.</p>
      )}
    </div>
  );
};
