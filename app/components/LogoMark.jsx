// RoadGame logo image (public/logo.png). Shared by mobile + desktop.
export default function LogoMark({ size = 32 }) {
  return (
    <img
      src="/logo.png"
      alt="RoadGame"
      style={{
        height: size,
        width: "auto",
        display: "block",
        objectFit: "contain",
      }}
    />
  );
}
