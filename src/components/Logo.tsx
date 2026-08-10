import logoSrc from '../assets/logo.png';

type LogoSize = 'hero' | 'mini';

export default function Logo({ size = 'hero' }: { size?: LogoSize }) {
  return (
    <img
      src={logoSrc}
      alt="Volidam Algoritm"
      className={`brand-logo brand-logo--${size}`}
      draggable={false}
    />
  );
}
