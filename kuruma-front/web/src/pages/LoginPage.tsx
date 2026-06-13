import { type SubmitEvent, useState } from 'react'

import { loginUser } from '../service/auth'
import { useNavigate } from 'react-router-dom'
import { useMessage } from '../components/message-context'

function LoginPage() {
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()
  const { showMessage } = useMessage()

  const canSubmit = account.trim().length > 0 && password.length > 0 && !isSubmitting

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!account.trim() || !password) {
      showMessage({ text: '请输入账号和密码', type: 'error' })
      return
    }

    setIsSubmitting(true)

    try {
      await loginUser({
        account: account.trim(),
        password,
      })
      navigate('/sessions')
    } catch (error) {
      showMessage({
        text: error instanceof Error ? error.message : '登录失败，请稍后重试',
        type: 'error',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#eef2f5] text-slate-900">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_30rem]">
        <section className="relative hidden overflow-hidden bg-slate-950 lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(16,185,129,0.35),transparent_34%),radial-gradient(circle_at_80%_70%,rgba(14,165,233,0.24),transparent_32%),linear-gradient(135deg,#020617,#0f172a_48%,#111827)]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.055)_1px,transparent_1px)] bg-[size:44px_44px]" />
          <div className="relative flex h-full flex-col justify-between p-10 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-emerald-500 text-lg font-bold text-white">
                K
              </div>
              <div>
                <div className="text-lg font-semibold">Kuruma 指挥台</div>
                <div className="text-sm text-slate-300">事故视频协同系统</div>
              </div>
            </div>

            <div className="max-w-xl">
              <p className="mb-5 text-sm font-medium text-emerald-200">POLICE DESKTOP CONSOLE</p>
              <h1 className="text-5xl font-semibold leading-tight tracking-normal">
                快速接入司机端事故会话
              </h1>
              <p className="mt-6 max-w-lg text-base leading-7 text-slate-300">
                统一查看实时视频、定位状态、网络质量与录像进度，帮助坐席在同一工作台完成远程取证。
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-md border border-white/10 bg-white/[0.08] p-4">
                <div className="text-2xl font-semibold">24/7</div>
                <div className="mt-1 text-slate-300">在线接警</div>
              </div>
              <div className="rounded-md border border-white/10 bg-white/[0.08] p-4">
                <div className="text-2xl font-semibold">RTC</div>
                <div className="mt-1 text-slate-300">视频信令</div>
              </div>
              <div className="rounded-md border border-white/10 bg-white/[0.08] p-4">
                <div className="text-2xl font-semibold">REC</div>
                <div className="mt-1 text-slate-300">证据留存</div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-md">
            <div className="mb-9 flex items-center gap-3 lg:hidden">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-emerald-600 text-lg font-bold text-white">
                K
              </div>
              <div>
                <div className="text-lg font-semibold">Kuruma 指挥台</div>
                <div className="text-sm text-slate-500">事故视频协同系统</div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-8">
                <p className="text-sm font-semibold text-emerald-700">账号登录</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
                  进入警员工作台
                </h2>
              </div>

              <form className="grid gap-5" onSubmit={handleSubmit}>
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  警员账号
                  <input
                    className="h-12 rounded-md border border-slate-200 bg-white px-4 text-base text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    autoComplete="username"
                    disabled={isSubmitting}
                    onChange={(event) => setAccount(event.target.value)}
                    placeholder="请输入账号"
                    type="text"
                    value={account}
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  密码
                  <input
                    className="h-12 rounded-md border border-slate-200 bg-white px-4 text-base text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    autoComplete="current-password"
                    disabled={isSubmitting}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="请输入密码"
                    type="password"
                    value={password}
                  />
                </label>

                <div className="flex items-center text-sm">
                  <label className="flex items-center gap-2 font-medium text-slate-600">
                    <input
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 accent-emerald-600"
                      disabled={isSubmitting}
                      type="checkbox"
                    />
                    保持登录
                  </label>
                </div>

                <button
                  className="mt-2 h-12 rounded-md bg-emerald-600 px-5 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-300"
                  disabled={!canSubmit}
                >
                  {isSubmitting ? '登录中...' : '登录'}
                </button>
              </form>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

export default LoginPage
