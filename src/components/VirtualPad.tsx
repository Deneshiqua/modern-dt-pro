import { Td, Tr } from "../ui";

export function VirtualPad({ height }: { height: number }) {
  if (height <= 0) {
    return null;
  }

  return (
    <Tr className="dtp-virtual-pad" aria-hidden="true" style={{ height }}>
      <Td className="dtp-virtual-pad-cell" />
    </Tr>
  );
}
