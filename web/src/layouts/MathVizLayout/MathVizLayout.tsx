const MathVizLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <main className="min-h-screen bg-white text-stone-950">
      <section className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 sm:px-6 lg:px-0">
        {children}
      </section>
    </main>
  )
}
export default MathVizLayout
