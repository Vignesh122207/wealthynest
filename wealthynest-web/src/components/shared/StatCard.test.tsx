import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCard } from "./StatCard";
import { Wallet } from "lucide-react";

describe("StatCard", () => {
  it("renders title, value, and subtitle", () => {
    render(<StatCard title="Net Worth" value="₹5,00,000" subtitle="as of today" icon={Wallet} />);
    expect(screen.getByText("Net Worth")).toBeInTheDocument();
    expect(screen.getByText("₹5,00,000")).toBeInTheDocument();
    expect(screen.getByText("as of today")).toBeInTheDocument();
  });

  it("omits the subtitle paragraph when not provided", () => {
    const { container } = render(<StatCard title="Net Worth" value="₹5,00,000" icon={Wallet} />);
    expect(container.querySelectorAll("p")).toHaveLength(2);
  });

  it("shows an up arrow badge for a non-negative trend", () => {
    render(<StatCard title="Net Worth" value="₹5,00,000" icon={Wallet} trend={12.5} />);
    expect(screen.getByText(/▲/)).toHaveTextContent("▲ 12.5%");
  });

  it("shows a down arrow badge for a negative trend", () => {
    render(<StatCard title="Net Worth" value="₹5,00,000" icon={Wallet} trend={-8.2} />);
    expect(screen.getByText(/▼/)).toHaveTextContent("▼ 8.2%");
  });

  it("shows a 'New' badge instead of a percentage when the trend magnitude exceeds 500", () => {
    render(<StatCard title="Net Worth" value="₹5,00,000" icon={Wallet} trend={900} />);
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.queryByText(/▲/)).not.toBeInTheDocument();
  });

  it("renders no trend badge when trend is undefined", () => {
    render(<StatCard title="Net Worth" value="₹5,00,000" icon={Wallet} />);
    expect(screen.queryByText(/▲|▼|New/)).not.toBeInTheDocument();
  });

  it("treats trend=0 as non-negative (up arrow, not down)", () => {
    render(<StatCard title="Net Worth" value="₹5,00,000" icon={Wallet} trend={0} />);
    expect(screen.getByText(/▲/)).toBeInTheDocument();
  });
});
