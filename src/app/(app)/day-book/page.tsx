import { DayBookClient } from "./day-book-client";

export const metadata = {
  title: "Day Book | Pawnify",
  description: "Chronological daily journal of counter transactions and cash flows",
};

export default function DayBookPage() {
  return <DayBookClient />;
}
