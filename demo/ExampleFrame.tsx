import { type ReactNode, useState } from "react";

type ExampleFrameProps = {
  title: string;
  description: string;
  code: string;
  children: ReactNode;
  tableHeight?: string;
};

export function ExampleFrame({
  title,
  description,
  code,
  children,
  tableHeight = "660px",
}: ExampleFrameProps) {
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>{title}</h2>
          <p className="desc">{description}</p>
        </div>
        <button
          type="button"
          className={showCode ? "pg-code-btn active" : "pg-code-btn"}
          onClick={() => setShowCode((value) => !value)}
        >
          Code
        </button>
      </div>

      <div className="example-table" style={{ height: tableHeight }}>
        {children}
      </div>

      {showCode ? (
        <div>
          <div className="demo-code-toolbar">
            <button type="button" onClick={() => void copyCode()}>
              {copied ? "Kopyalandı" : "Kopyala"}
            </button>
          </div>
          <pre className="demo-code">
            <code>{code}</code>
          </pre>
        </div>
      ) : null}
    </section>
  );
}
