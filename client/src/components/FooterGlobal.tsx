export default function FooterGlobal() {
  return (
    <footer className="border-t border-stone-800/60 bg-stone-900">
      <p className="mx-auto px-4 py-4 text-center text-sm text-stone-400">
        © {new Date().getFullYear()} FoodOrdering - Niên luận ngành
      </p>
    </footer>
  )
}