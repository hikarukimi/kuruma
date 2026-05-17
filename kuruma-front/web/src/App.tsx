function App() {
  const statusItems = [
    { label: '网络', value: '良好' },
    { label: '司机端', value: '在线' },
    { label: '信令', value: '已连接' },
  ]

  const controls = [
    { text: '静音', tone: 'bg-white text-slate-800 ring-slate-200' },
    { text: '摄像头', tone: 'bg-white text-slate-800 ring-slate-200' },
    { text: '开始录像', tone: 'bg-emerald-600 text-white ring-emerald-600' },
    { text: '结束通话', tone: 'bg-rose-600 text-white ring-rose-600' },
  ]

  return (
    <main className="min-h-screen bg-[#f4f6f8] p-4 text-slate-900 md:p-8">
      <section className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-6xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm md:min-h-[calc(100vh-4rem)]">
        <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-4">
          <div className="font-semibold tracking-wide">ACC-20260513-0001</div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
            通话中
          </span>
          <span className="font-mono text-sm text-slate-600">03:25</span>
          <span className="ml-auto inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-700">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            录像中
          </span>
          <button className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            返回列表
          </button>
        </header>

        <div className="grid flex-1 gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <section className="relative min-h-[22rem] overflow-hidden rounded-lg bg-slate-950">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_25%,rgba(56,189,248,0.28),transparent_34%),linear-gradient(135deg,#0f172a,#111827_52%,#18181b)]" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:42px_42px]" />
            <div className="relative flex h-full min-h-[22rem] items-center justify-center">
              <div className="rounded-full border border-white/15 bg-white/10 px-6 py-3 text-lg font-medium text-white/85">
                远端视频画面
              </div>
            </div>
            <div className="absolute right-4 bottom-4 h-32 w-44 overflow-hidden rounded-md border border-white/20 bg-slate-800 shadow-lg">
              <div className="flex h-full items-center justify-center bg-[linear-gradient(145deg,#475569,#1f2937)] text-sm font-medium text-white/85">
                本地预览
              </div>
            </div>
          </section>

          <aside className="grid content-start gap-5">
            <section className="rounded-lg border border-slate-200 p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-500">会话信息</h2>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">司机</dt>
                  <dd className="font-medium">李某</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">电话</dt>
                  <dd className="font-medium">138****</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">位置</dt>
                  <dd className="font-medium text-emerald-700">已获取</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">网络</dt>
                  <dd className="font-medium text-emerald-700">良好</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-lg border border-slate-200 p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-500">事故描述</h2>
              <p className="text-sm leading-6 text-slate-700">
                车辆追尾，司机已在路边等待处理，现场无明显人员受伤。
              </p>
            </section>
          </aside>
        </div>

        <footer className="border-t border-slate-200 px-5 py-5">
          <div className="mb-5 flex flex-wrap gap-x-10 gap-y-2 text-sm">
            {statusItems.map((item) => (
              <span key={item.label} className="text-slate-500">
                {item.label}: <strong className="font-semibold text-emerald-700">{item.value}</strong>
              </span>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            {controls.map((control) => (
              <button
                key={control.text}
                className={`min-w-24 rounded-md px-5 py-3 text-sm font-semibold ring-1 ${control.tone}`}
              >
                {control.text}
              </button>
            ))}
          </div>
        </footer>
      </section>
    </main>
  )
}

export default App
