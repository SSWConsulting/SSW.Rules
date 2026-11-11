import type { FC } from "react";
import type { InputFieldType } from "tinacms";

/** Props Tina passes to a custom field component: `input`, `meta`, `field`, plus the `form` (Final Form) and `tinaForm` instances. */
export type TinaFieldProps = InputFieldType<{}, {}>;

/**
 * Tina's schema types `ui.component` props as `{ field, input, meta }` only, even though `form` and `tinaForm` are passed at runtime,
 * so a component typed with `TinaFieldProps` isn't assignable to it. This plugs a typed field component into the schema.
 */
export const asSchemaComponent = (component: FC<TinaFieldProps>) => component as FC<unknown>;
