"use client";

export default function ConfirmSubmitButton({
  children,
  message,
  className = "btn",
  name,
  value,
  disabled = false,
}: {
  children: React.ReactNode;
  message: string;
  className?: string;
  name?: string;
  value?: string;
  disabled?: boolean;
}) {
  return (
    <button
      className={className}
      type="submit"
      name={name}
      value={value}
      disabled={disabled}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
