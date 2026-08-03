import type { LocalizedText } from '../types';

export default function LocalizedInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: LocalizedText;
  onChange: (next: LocalizedText) => void;
}) {
  const langs: (keyof LocalizedText)[] = ['uz', 'ru', 'en'];
  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {langs.map((l) => (
          <input
            key={l}
            value={value[l]}
            onChange={(e) => onChange({ ...value, [l]: e.target.value })}
            placeholder={l.toUpperCase()}
          />
        ))}
      </div>
    </div>
  );
}
