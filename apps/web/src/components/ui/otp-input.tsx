import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

const OTP_LENGTH = 6;

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * Six-cell one-time-code input with paste, backspace, and SMS autofill support.
 * @param value - Current digits
 * @param onChange - Called whenever the code changes
 * @param onComplete - Called once all six digits are filled
 * @param disabled - Locks the cells during submit
 * @param autoFocus - Focuses the first empty cell on mount
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  autoFocus = true,
}: OtpInputProps) {
  const slots = Array.from({ length: OTP_LENGTH }, (_, index) => value[index] ?? "");
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (!autoFocus || disabled) return;
    const index = Math.min(value.length, OTP_LENGTH - 1);
    refs.current[index]?.focus();
  }, [autoFocus, disabled, value.length]);

  /**
   * Normalizes digits, updates the parent, and focuses the next empty cell.
   * @param next - Candidate code
   */
  function commit(next: string): void {
    const cleaned = next.replace(/\D/g, "").slice(0, OTP_LENGTH);
    onChange(cleaned);
    if (cleaned.length === OTP_LENGTH) {
      refs.current[OTP_LENGTH - 1]?.blur();
      onComplete?.(cleaned);
      return;
    }
    refs.current[cleaned.length]?.focus();
  }

  /**
   * Accepts a typed digit or an autofill dump into the first cell.
   * @param index - Cell index
   * @param raw - Native input value
   */
  function onSlotChange(index: number, raw: string): void {
    if (disabled) return;
    const incoming = raw.replace(/\D/g, "");
    if (!incoming) {
      commit(value.slice(0, index));
      return;
    }
    commit(value.slice(0, index) + incoming);
  }

  /**
   * Clears the current cell, or the previous one when the current cell is empty.
   * @param index - Cell index
   * @param event - Keyboard event
   */
  function onSlotKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>): void {
    if (disabled) return;

    if (event.key === "Backspace") {
      event.preventDefault();
      if (value[index]) {
        commit(value.slice(0, index) + value.slice(index + 1));
        refs.current[index]?.focus();
      } else if (index > 0) {
        commit(value.slice(0, index - 1));
        refs.current[index - 1]?.focus();
      }
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      refs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      event.preventDefault();
      refs.current[index + 1]?.focus();
    }
  }

  /**
   * Fills all cells from a pasted one-time code.
   * @param event - Clipboard paste
   */
  function onSlotPaste(event: ClipboardEvent<HTMLInputElement>): void {
    event.preventDefault();
    if (disabled) return;
    commit(event.clipboardData.getData("text"));
  }

  return (
    <div className="flex gap-2" role="group" aria-label="6 位验证码">
      {slots.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          pattern="\d*"
          maxLength={index === 0 ? OTP_LENGTH : 1}
          aria-label={`第 ${index + 1} 位验证码`}
          disabled={disabled}
          value={digit}
          onChange={(event) => onSlotChange(index, event.target.value)}
          onKeyDown={(event) => onSlotKeyDown(index, event)}
          onPaste={onSlotPaste}
          onFocus={(event) => event.currentTarget.select()}
          className={cn(
            "h-12 min-w-0 flex-1 rounded-md border border-border bg-white text-center font-mono text-lg font-medium outline-none transition-shadow",
            "focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />
      ))}
    </div>
  );
}
