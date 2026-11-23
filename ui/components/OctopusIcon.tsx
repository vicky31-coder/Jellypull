export function OctopusIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Octopus Dome Head */}
      <path
        d="M12 3C7.8 3 5 5.9 5 9.6c0 2.1.9 3.6 2.1 4.5-.7 1.3-1.7 2.4-2.8 3.1a1 1 0 0 0 .5 1.8c1.5.1 2.9-.7 3.8-2.1.2 1.4 0 2.7-.5 3.8a1 1 0 0 0 1.8.8c.7-1.1 1.2-2.5 1.3-4 .5.1 1.1.1 1.6 0 .1 1.5.6 2.9 1.3 4a1 1 0 0 0 1.8-.8c-.5-1.1-.7-2.4-.5-3.8.9 1.4 2.3 2.2 3.8 2.1a1 1 0 0 0 .5-1.8c-1.1-.7-2.1-1.8-2.8-3.1C18.1 13.2 19 11.7 19 9.6 19 5.9 16.2 3 12 3Z"
        fill="currentColor"
      />
      {/* Eyes */}
      <circle cx="9.6" cy="9.8" r="1.2" fill="rgb(var(--mdui-color-primary-container))" />
      <circle cx="14.4" cy="9.8" r="1.2" fill="rgb(var(--mdui-color-primary-container))" />
    </svg>
  );
}
