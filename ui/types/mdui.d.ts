import "mdui/jsx.en.d.ts";

declare module "react" {
  interface HTMLAttributes<T> {
    slot?: string;
  }
}
