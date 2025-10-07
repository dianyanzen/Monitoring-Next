export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer text-center py-6 text-sm text-gray-400 border-t border-gray-800">
      Copyright &copy; {year}{" "}
      <span className="text-cyan-400 font-semibold">DianYanzen</span>, DisdukCapil Kota Bandung
    </footer>
  );
}
