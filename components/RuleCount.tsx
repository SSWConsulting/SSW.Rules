import { PiGavelFill } from "react-icons/pi";

interface RuleCountProps {
  count: number;
  label?: string;
}

export default function RuleCount({ count, label = "SSW Rules" }: RuleCountProps) {
  return (
    <div className="flex justify-center">
      <div className="flex">
        <PiGavelFill
          size={48}
          className="transform rotate-270 text-[var(--ssw-red)]"
        />
        <div className="flex flex-col justify-center items-center ml-2">
          <span className="text-3xl font-semibold text-[var(--ssw-red)]">
            {count.toLocaleString("en-US")}
          </span>
          <span className="font-light">{label}</span>
        </div>
      </div>
    </div>
  );
}