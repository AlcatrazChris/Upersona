export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #e8f0ff 0%, #f5f0ff 50%, #ffe8f5 100%)' }}>
      {children}
    </div>
  );
}
