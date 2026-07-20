import {
  backdropBlob1,
  backdropBlob2,
} from "@/styles/pages/loginPage";

export function LoginBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
      <div className={backdropBlob1} />
      <div className={backdropBlob2} />
    </div>
  );
}
