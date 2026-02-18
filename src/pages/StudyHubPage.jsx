import { useEffect, useMemo, useState } from 'react'
import {
  AlarmClock,
  CalendarClock,
  CheckCircle2,
  Flame,
  Goal,
  Medal,
  NotepadText,
  Plus,
  Rocket,
  Trash2,
  Trophy,
} from 'lucide-react'
import { useTasks } from '../state/tasks/tasksContext.js'
import { getStoredJSON, setStoredJSON } from '../utils/storage.js'
import { newId } from '../utils/ids.js'

const STORAGE_KEY = 'studentDashboard.studyHub.v1'

const QUOTES = [
  'Pequenos passos diarios vencem grandes planos nunca iniciados.',
  'Consistencia supera motivacao quando o objetivo e longo.',
  'Uma sessao focada vale mais que horas dispersas.',
  'Estudar hoje reduz o estresse de amanha.',
  'Progresso real aparece quando voce repete o basico.',
  'Disciplina e liberdade para o seu eu do futuro.',
  'Foco agora, resultado depois.',
]

const BADGES = [
  { id: 'first-hour', label: 'Primeira Hora', rule: (ctx) => ctx.totalMinutes >= 60 },
  { id: 'focused-week', label: 'Semana Focada', rule: (ctx) => ctx.weekMinutes >= 600 },
  { id: 'streak-3', label: 'Streak 3 dias', rule: (ctx) => ctx.currentStreak >= 3 },
  { id: 'goal-hunter', label: 'Meta Batida', rule: (ctx) => ctx.reachedGoals > 0 },
  { id: 'challenge-win', label: 'Desafio Vencido', rule: (ctx) => ctx.completedChallenges > 0 },
]

function getTodayIso() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function parseIso(isoDate) {
  const text = String(isoDate || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null
  const [y, m, d] = text.split('-').map((n) => Number(n))
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function toIso(date) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function formatDateLabel(isoDate) {
  const parsed = parseIso(isoDate)
  if (!parsed) return '-'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed)
}

function daysUntil(isoDate) {
  const parsed = parseIso(isoDate)
  if (!parsed) return null
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

function getWeekRange(baseDate = new Date()) {
  const base = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate())
  const day = base.getDay()
  const shift = day === 0 ? -6 : 1 - day
  const start = new Date(base)
  start.setDate(base.getDate() + shift)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return { start: toIso(start), end: toIso(end) }
}

function inRange(isoDate, startIso, endIso) {
  if (!isoDate) return false
  return isoDate >= startIso && isoDate <= endIso
}

function sumMinutes(logs) {
  return logs.reduce((acc, item) => acc + Math.max(0, Number(item.minutes) || 0), 0)
}

function formatMinutes(totalMinutes) {
  const minutes = Math.max(0, Math.round(Number(totalMinutes) || 0))
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours <= 0) return `${rest}m`
  if (rest <= 0) return `${hours}h`
  return `${hours}h ${rest}m`
}

function normalizeState(raw) {
  const base = raw && typeof raw === 'object' ? raw : {}
  return {
    logs: Array.isArray(base.logs) ? base.logs : [],
    goals: Array.isArray(base.goals) ? base.goals : [],
    exams: Array.isArray(base.exams) ? base.exams : [],
    challenges: Array.isArray(base.challenges) ? base.challenges : [],
    notesBySubject:
      base.notesBySubject && typeof base.notesBySubject === 'object' ? base.notesBySubject : {},
    sessionsByDate:
      base.sessionsByDate && typeof base.sessionsByDate === 'object' ? base.sessionsByDate : {},
    pomodoro: {
      focusMinutes: Number(base.pomodoro?.focusMinutes) > 0 ? Number(base.pomodoro.focusMinutes) : 25,
      breakMinutes: Number(base.pomodoro?.breakMinutes) > 0 ? Number(base.pomodoro.breakMinutes) : 5,
      subject: String(base.pomodoro?.subject || ''),
    },
  }
}

function calculateStreak(logs) {
  const uniqueDates = [...new Set(logs.map((item) => item.date).filter(Boolean))].sort()
  if (uniqueDates.length === 0) return { current: 0, longest: 0, lastDate: '' }

  let longest = 1
  let run = 1

  for (let i = 1; i < uniqueDates.length; i += 1) {
    const prev = parseIso(uniqueDates[i - 1])
    const cur = parseIso(uniqueDates[i])
    if (!prev || !cur) continue
    const diff = Math.round((cur.getTime() - prev.getTime()) / 86400000)
    if (diff === 1) {
      run += 1
      if (run > longest) longest = run
    } else {
      run = 1
    }
  }

  let current = 0
  const todayIso = getTodayIso()
  if (uniqueDates[uniqueDates.length - 1] === todayIso) {
    current = 1
    for (let i = uniqueDates.length - 1; i > 0; i -= 1) {
      const prev = parseIso(uniqueDates[i - 1])
      const cur = parseIso(uniqueDates[i])
      if (!prev || !cur) break
      const diff = Math.round((cur.getTime() - prev.getTime()) / 86400000)
      if (diff === 1) current += 1
      else break
    }
  }

  return { current, longest, lastDate: uniqueDates[uniqueDates.length - 1] || '' }
}

export default function StudyHubPage() {
  const { tasks } = useTasks()

  const [studyData, setStudyData] = useState(() => normalizeState(getStoredJSON(STORAGE_KEY, {})))
  const [timerMode, setTimerMode] = useState('focus')
  const [timerRunning, setTimerRunning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(() => studyData.pomodoro.focusMinutes * 60)

  const todayIso = getTodayIso()
  const weekRange = useMemo(() => getWeekRange(new Date()), [])

  const [logForm, setLogForm] = useState(() => ({
    date: todayIso,
    subject: '',
    minutes: 60,
  }))
  const [goalForm, setGoalForm] = useState(() => ({
    title: '',
    subject: '',
    targetMinutes: 240,
    period: 'daily',
  }))
  const [examForm, setExamForm] = useState(() => ({
    title: '',
    subject: '',
    date: '',
  }))
  const [challengeForm, setChallengeForm] = useState(() => ({
    title: '',
    subject: '',
    targetMinutes: 180,
    rewardPoints: 60,
  }))
  const [noteSubject, setNoteSubject] = useState('')

  useEffect(() => {
    setStoredJSON(STORAGE_KEY, studyData)
  }, [studyData])

  useEffect(() => {
    if (!timerRunning) return undefined
    const timerId = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev > 1) return prev - 1

        if (timerMode === 'focus') {
          const minutes = Math.max(1, studyData.pomodoro.focusMinutes)
          const subject = String(studyData.pomodoro.subject || '').trim()
          const log = {
            id: newId(),
            date: getTodayIso(),
            subject,
            minutes,
            source: 'pomodoro',
            createdAt: Date.now(),
          }
          setStudyData((data) => {
            const today = getTodayIso()
            const sessions = Number(data.sessionsByDate?.[today] || 0) + 1
            return {
              ...data,
              logs: [log, ...(data.logs || [])],
              sessionsByDate: {
                ...(data.sessionsByDate || {}),
                [today]: sessions,
              },
            }
          })
          setTimerMode('break')
          return Math.max(1, studyData.pomodoro.breakMinutes * 60)
        }

        setTimerMode('focus')
        setTimerRunning(false)
        return Math.max(1, studyData.pomodoro.focusMinutes * 60)
      })
    }, 1000)
    return () => clearInterval(timerId)
  }, [
    studyData.pomodoro.breakMinutes,
    studyData.pomodoro.focusMinutes,
    studyData.pomodoro.subject,
    timerMode,
    timerRunning,
  ])

  const subjectOptions = useMemo(() => {
    const names = new Set()
    for (const task of tasks) {
      const subject = String(task.subject || '').trim()
      if (subject) names.add(subject)
    }
    for (const item of studyData.logs) {
      const subject = String(item.subject || '').trim()
      if (subject) names.add(subject)
    }
    for (const item of studyData.goals) {
      const subject = String(item.subject || '').trim()
      if (subject) names.add(subject)
    }
    for (const item of studyData.exams) {
      const subject = String(item.subject || '').trim()
      if (subject) names.add(subject)
    }
    for (const item of studyData.challenges) {
      const subject = String(item.subject || '').trim()
      if (subject) names.add(subject)
    }
    for (const key of Object.keys(studyData.notesBySubject || {})) {
      const subject = String(key || '').trim()
      if (subject) names.add(subject)
    }
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [
    studyData.challenges,
    studyData.exams,
    studyData.goals,
    studyData.logs,
    studyData.notesBySubject,
    tasks,
  ])

  const activeNoteSubject =
    noteSubject && subjectOptions.includes(noteSubject) ? noteSubject : subjectOptions[0] || ''

  const todayLogs = useMemo(
    () => studyData.logs.filter((item) => item.date === todayIso),
    [studyData.logs, todayIso],
  )
  const weekLogs = useMemo(
    () => studyData.logs.filter((item) => inRange(item.date, weekRange.start, weekRange.end)),
    [studyData.logs, weekRange.end, weekRange.start],
  )

  const todayMinutes = useMemo(() => sumMinutes(todayLogs), [todayLogs])
  const weekMinutes = useMemo(() => sumMinutes(weekLogs), [weekLogs])
  const totalMinutes = useMemo(() => sumMinutes(studyData.logs), [studyData.logs])

  const pomodoroSessionsToday = Number(studyData.sessionsByDate?.[todayIso] || 0)
  const pomodoroSessionsWeek = useMemo(() => {
    const entries = Object.entries(studyData.sessionsByDate || {})
    return entries.reduce((acc, [date, count]) => {
      if (!inRange(date, weekRange.start, weekRange.end)) return acc
      return acc + Math.max(0, Number(count) || 0)
    }, 0)
  }, [studyData.sessionsByDate, weekRange.end, weekRange.start])

  const streak = useMemo(() => calculateStreak(studyData.logs), [studyData.logs])

  const upcomingExams = useMemo(() => {
    return [...studyData.exams]
      .filter((exam) => parseIso(exam.date))
      .sort((a, b) => {
        if (a.date < b.date) return -1
        if (a.date > b.date) return 1
        return String(a.title || '').localeCompare(String(b.title || ''))
      })
  }, [studyData.exams])

  const nextExam = useMemo(() => {
    return upcomingExams.find((exam) => {
      const delta = daysUntil(exam.date)
      return delta !== null && delta >= 0
    })
  }, [upcomingExams])

  const goalsWithProgress = useMemo(() => {
    return studyData.goals.map((goal) => {
      const scopedLogs =
        goal.period === 'daily'
          ? studyData.logs.filter((item) => item.date === todayIso)
          : studyData.logs.filter((item) => inRange(item.date, weekRange.start, weekRange.end))
      const bySubject = scopedLogs.filter((item) => {
        const targetSubject = String(goal.subject || '').trim()
        if (!targetSubject) return true
        return String(item.subject || '').trim() === targetSubject
      })
      const minutes = sumMinutes(bySubject)
      const target = Math.max(1, Number(goal.targetMinutes) || 1)
      const progress = Math.min(100, Math.round((minutes / target) * 100))
      return {
        ...goal,
        currentMinutes: minutes,
        targetMinutes: target,
        progress,
        reached: minutes >= target,
      }
    })
  }, [studyData.goals, studyData.logs, todayIso, weekRange.end, weekRange.start])

  const challengesWithProgress = useMemo(() => {
    return studyData.challenges.map((challenge) => {
      const bySubject = weekLogs.filter((item) => {
        const subject = String(challenge.subject || '').trim()
        if (!subject) return true
        return String(item.subject || '').trim() === subject
      })
      const minutes = sumMinutes(bySubject)
      const target = Math.max(1, Number(challenge.targetMinutes) || 1)
      const progress = Math.min(100, Math.round((minutes / target) * 100))
      return {
        ...challenge,
        currentMinutes: minutes,
        progress,
        reached: minutes >= target,
      }
    })
  }, [studyData.challenges, weekLogs])

  const reachedGoals = goalsWithProgress.filter((goal) => goal.reached).length
  const completedChallenges = challengesWithProgress.filter((challenge) => challenge.reached).length

  const ranking = useMemo(() => {
    const map = new Map()
    for (const subject of subjectOptions) {
      map.set(subject, { subject, minutes: 0, pendingTasks: 0, urgencyPoints: 0, focusNeed: 0 })
    }

    for (const log of weekLogs) {
      const subject = String(log.subject || '').trim() || 'Sem materia'
      if (!map.has(subject)) {
        map.set(subject, { subject, minutes: 0, pendingTasks: 0, urgencyPoints: 0, focusNeed: 0 })
      }
      const row = map.get(subject)
      row.minutes += Math.max(0, Number(log.minutes) || 0)
    }

    for (const task of tasks) {
      if (task.status === 'done') continue
      const subject = String(task.subject || '').trim() || 'Sem materia'
      if (!map.has(subject)) {
        map.set(subject, { subject, minutes: 0, pendingTasks: 0, urgencyPoints: 0, focusNeed: 0 })
      }
      const row = map.get(subject)
      row.pendingTasks += 1
    }

    for (const exam of upcomingExams) {
      const subject = String(exam.subject || '').trim() || 'Sem materia'
      if (!map.has(subject)) {
        map.set(subject, { subject, minutes: 0, pendingTasks: 0, urgencyPoints: 0, focusNeed: 0 })
      }
      const delta = daysUntil(exam.date)
      if (delta === null || delta < 0) continue
      const urgency = Math.max(0, 14 - delta) * 12
      const row = map.get(subject)
      if (urgency > row.urgencyPoints) row.urgencyPoints = urgency
    }

    const rows = [...map.values()].map((row) => {
      const focusNeed = row.pendingTasks * 60 + row.urgencyPoints - row.minutes
      return { ...row, focusNeed }
    })

    const mostStudied = [...rows].sort((a, b) => {
      if (b.minutes !== a.minutes) return b.minutes - a.minutes
      return a.subject.localeCompare(b.subject)
    })

    const needsFocus = [...rows]
      .filter((row) => row.focusNeed > 0)
      .sort((a, b) => {
        if (b.focusNeed !== a.focusNeed) return b.focusNeed - a.focusNeed
        return a.subject.localeCompare(b.subject)
      })

    return { mostStudied, needsFocus }
  }, [subjectOptions, tasks, upcomingExams, weekLogs])

  const quoteOfDay = useMemo(() => {
    const today = parseIso(todayIso) || new Date()
    const daySerial = Math.floor(today.getTime() / 86400000)
    const index = Math.abs(daySerial) % QUOTES.length
    return QUOTES[index]
  }, [todayIso])

  const challengePoints = challengesWithProgress
    .filter((item) => item.reached)
    .reduce((acc, item) => acc + Math.max(0, Number(item.rewardPoints) || 0), 0)
  const studyPoints = Math.floor(totalMinutes / 30) * 2
  const streakPoints = streak.current * 8
  const goalPoints = reachedGoals * 25
  const points = studyPoints + streakPoints + goalPoints + challengePoints

  const badges = BADGES.map((badge) => ({
    ...badge,
    unlocked: badge.rule({
      totalMinutes,
      weekMinutes,
      currentStreak: streak.current,
      reachedGoals,
      completedChallenges,
    }),
  }))

  const doneTasks = tasks.filter((task) => task.status === 'done').length
  const pendingTasks = tasks.length - doneTasks

  const summaryCards = [
    {
      key: 'today',
      label: 'Estudo hoje',
      value: formatMinutes(todayMinutes),
      icon: AlarmClock,
    },
    {
      key: 'week',
      label: 'Semana atual',
      value: formatMinutes(weekMinutes),
      icon: CalendarClock,
    },
    {
      key: 'streak',
      label: 'Streak',
      value: `${streak.current} dia${streak.current === 1 ? '' : 's'}`,
      icon: Flame,
    },
    {
      key: 'points',
      label: 'Pontos',
      value: String(points),
      icon: Medal,
    },
  ]

  function setPomodoroField(name, rawValue) {
    if (name !== 'subject') {
      const numeric = Number(rawValue)
      const nextValue = Math.max(1, Math.min(180, Number.isFinite(numeric) ? numeric : 1))
      const editingFocus = name === 'focusMinutes' && timerMode === 'focus'
      const editingBreak = name === 'breakMinutes' && timerMode === 'break'
      if (!timerRunning && (editingFocus || editingBreak)) {
        setSecondsLeft(nextValue * 60)
      }
    }

    setStudyData((prev) => {
      if (name === 'subject') {
        return {
          ...prev,
          pomodoro: {
            ...prev.pomodoro,
            subject: String(rawValue || ''),
          },
        }
      }

      const numeric = Number(rawValue)
      const value = Math.max(1, Math.min(180, Number.isFinite(numeric) ? numeric : 1))
      return {
        ...prev,
        pomodoro: {
          ...prev.pomodoro,
          [name]: value,
        },
      }
    })
  }

  function resetPomodoro() {
    setTimerRunning(false)
    setTimerMode('focus')
    setSecondsLeft(Math.max(1, studyData.pomodoro.focusMinutes * 60))
  }

  function submitManualLog(event) {
    event.preventDefault()
    const minutes = Math.max(1, Number(logForm.minutes) || 0)
    const date = String(logForm.date || '').trim() || todayIso
    if (!parseIso(date)) return

    const payload = {
      id: newId(),
      date,
      subject: String(logForm.subject || '').trim(),
      minutes,
      source: 'manual',
      createdAt: Date.now(),
    }

    setStudyData((prev) => ({ ...prev, logs: [payload, ...(prev.logs || [])] }))
    setLogForm((prev) => ({ ...prev, minutes: prev.minutes }))
  }

  function submitGoal(event) {
    event.preventDefault()
    const title = String(goalForm.title || '').trim()
    if (!title) return

    const payload = {
      id: newId(),
      title,
      subject: String(goalForm.subject || '').trim(),
      targetMinutes: Math.max(10, Number(goalForm.targetMinutes) || 0),
      period: goalForm.period === 'weekly' ? 'weekly' : 'daily',
      createdAt: Date.now(),
    }

    setStudyData((prev) => ({ ...prev, goals: [payload, ...(prev.goals || [])] }))
    setGoalForm((prev) => ({ ...prev, title: '', targetMinutes: prev.targetMinutes }))
  }

  function submitExam(event) {
    event.preventDefault()
    const title = String(examForm.title || '').trim()
    const date = String(examForm.date || '').trim()
    if (!title || !parseIso(date)) return

    const payload = {
      id: newId(),
      title,
      date,
      subject: String(examForm.subject || '').trim(),
      createdAt: Date.now(),
    }

    setStudyData((prev) => ({ ...prev, exams: [payload, ...(prev.exams || [])] }))
    setExamForm({ title: '', subject: '', date: '' })
  }

  function submitChallenge(event) {
    event.preventDefault()
    const title = String(challengeForm.title || '').trim()
    if (!title) return

    const payload = {
      id: newId(),
      title,
      subject: String(challengeForm.subject || '').trim(),
      targetMinutes: Math.max(20, Number(challengeForm.targetMinutes) || 0),
      rewardPoints: Math.max(5, Number(challengeForm.rewardPoints) || 0),
      createdAt: Date.now(),
    }

    setStudyData((prev) => ({ ...prev, challenges: [payload, ...(prev.challenges || [])] }))
    setChallengeForm((prev) => ({ ...prev, title: '' }))
  }

  function removeFromList(listName, id) {
    setStudyData((prev) => {
      const current = Array.isArray(prev[listName]) ? prev[listName] : []
      return { ...prev, [listName]: current.filter((item) => item.id !== id) }
    })
  }

  function updateNote(subject, text) {
    const key = String(subject || '').trim()
    if (!key) return
    setStudyData((prev) => ({
      ...prev,
      notesBySubject: {
        ...(prev.notesBySubject || {}),
        [key]: text,
      },
    }))
  }

  const timerMinutes = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const timerSeconds = String(secondsLeft % 60).padStart(2, '0')
  const nextExamCountdown = nextExam ? daysUntil(nextExam.date) : null

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-24 pt-4 md:pb-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-app md:text-xl">Estudos</h1>
          <p className="mt-1 text-sm text-muted">Resumo diario, foco e metas em um unico lugar.</p>
        </div>
        <div className="rounded-xl border border-app bg-surface px-3 py-2 text-xs text-muted">
          Frase do dia: <span className="font-semibold text-app">{quoteOfDay}</span>
        </div>
      </div>

      <div className="dash-hero dash-enter mt-4 rounded-2xl border border-app p-4" style={{ animationDelay: '30ms' }}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {summaryCards.map((card, index) => {
            const Icon = card.icon
            return (
              <div
                key={card.key}
                className="dash-card dash-enter rounded-xl border border-app bg-surface/70 p-3"
                style={{ animationDelay: `${80 + index * 70}ms` }}
              >
                <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-wide text-muted">
                  <span>{card.label}</span>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="mt-2 text-xl font-semibold text-app">{card.value}</div>
              </div>
            )
          })}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-app bg-surface/70 p-3">
            <div className="text-xs text-muted">Resumo do dia</div>
            <div className="mt-1 text-sm text-app">
              {formatMinutes(todayMinutes)} estudados, {pomodoroSessionsToday} pomodoro
              {pomodoroSessionsToday === 1 ? '' : 's'} finalizado
              {pomodoroSessionsToday === 1 ? '' : 's'}.
            </div>
          </div>
          <div className="rounded-xl border border-app bg-surface/70 p-3">
            <div className="text-xs text-muted">Proxima prova</div>
            <div className="mt-1 text-sm text-app">
              {nextExam
                ? `${nextExam.title} (${nextExamCountdown} dia${nextExamCountdown === 1 ? '' : 's'})`
                : 'Nenhuma prova futura cadastrada.'}
            </div>
          </div>
          <div className="rounded-xl border border-app bg-surface/70 p-3">
            <div className="text-xs text-muted">Tarefas</div>
            <div className="mt-1 text-sm text-app">
              {doneTasks} concluidas e {pendingTasks} pendentes.
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="dash-enter rounded-2xl border border-app bg-surface p-4" style={{ animationDelay: '80ms' }}>
          <div className="flex items-center gap-2 text-sm font-semibold text-app">
            <AlarmClock className="h-4 w-4" />
            Pomodoro integrado
          </div>

          <div className="mt-3 rounded-xl border border-app bg-surface2/60 p-4 text-center">
            <div className="text-xs uppercase tracking-wide text-muted">
              {timerMode === 'focus' ? 'Foco' : 'Pausa'}
            </div>
            <div className="mt-2 text-4xl font-semibold text-app">
              {timerMinutes}:{timerSeconds}
            </div>
            <div className="mt-1 text-xs text-muted">
              {timerMode === 'focus'
                ? `Sessao de ${studyData.pomodoro.focusMinutes} min`
                : `Pausa de ${studyData.pomodoro.breakMinutes} min`}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setTimerRunning((prev) => !prev)}
                className="dash-tab rounded-xl px-3 py-2 text-sm btn-primary"
              >
                {timerRunning ? 'Pausar' : 'Iniciar'}
              </button>
              <button
                type="button"
                onClick={resetPomodoro}
                className="dash-tab rounded-xl border border-app bg-surface px-3 py-2 text-sm text-app"
              >
                Resetar
              </button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="block">
              <div className="text-xs text-muted">Foco (min)</div>
              <input
                type="number"
                min={1}
                max={180}
                value={studyData.pomodoro.focusMinutes}
                onChange={(e) => setPomodoroField('focusMinutes', e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-app bg-surface px-3 text-sm text-app"
              />
            </label>

            <label className="block">
              <div className="text-xs text-muted">Pausa (min)</div>
              <input
                type="number"
                min={1}
                max={60}
                value={studyData.pomodoro.breakMinutes}
                onChange={(e) => setPomodoroField('breakMinutes', e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-app bg-surface px-3 text-sm text-app"
              />
            </label>

            <label className="block">
              <div className="text-xs text-muted">Materia da sessao</div>
              <input
                value={studyData.pomodoro.subject}
                onChange={(e) => setPomodoroField('subject', e.target.value)}
                placeholder="Ex: Matematica"
                className="mt-1 h-10 w-full rounded-xl border border-app bg-surface px-3 text-sm text-app placeholder:text-muted"
              />
            </label>
          </div>
        </section>

        <section className="dash-enter rounded-2xl border border-app bg-surface p-4" style={{ animationDelay: '120ms' }}>
          <div className="flex items-center gap-2 text-sm font-semibold text-app">
            <CalendarClock className="h-4 w-4" />
            Registro de horas e estatisticas semanais
          </div>

          <form onSubmit={submitManualLog} className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
            <input
              type="date"
              value={logForm.date}
              onChange={(e) => setLogForm((prev) => ({ ...prev, date: e.target.value }))}
              className="h-10 rounded-xl border border-app bg-surface px-3 text-sm text-app"
            />
            <input
              value={logForm.subject}
              onChange={(e) => setLogForm((prev) => ({ ...prev, subject: e.target.value }))}
              placeholder="Materia"
              className="h-10 rounded-xl border border-app bg-surface px-3 text-sm text-app placeholder:text-muted"
            />
            <input
              type="number"
              min={1}
              step={5}
              value={logForm.minutes}
              onChange={(e) => setLogForm((prev) => ({ ...prev, minutes: e.target.value }))}
              className="h-10 rounded-xl border border-app bg-surface px-3 text-sm text-app"
            />
            <button type="submit" className="dash-tab rounded-xl px-3 text-sm btn-primary">
              <span className="inline-flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Registrar
              </span>
            </button>
          </form>

          <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <div className="rounded-xl border border-app bg-surface2/60 p-3">
              <div className="text-xs text-muted">Hoje</div>
              <div className="mt-1 font-semibold text-app">{formatMinutes(todayMinutes)}</div>
            </div>
            <div className="rounded-xl border border-app bg-surface2/60 p-3">
              <div className="text-xs text-muted">Semana</div>
              <div className="mt-1 font-semibold text-app">{formatMinutes(weekMinutes)}</div>
            </div>
            <div className="rounded-xl border border-app bg-surface2/60 p-3">
              <div className="text-xs text-muted">Pomodoros (semana)</div>
              <div className="mt-1 font-semibold text-app">{pomodoroSessionsWeek}</div>
            </div>
            <div className="rounded-xl border border-app bg-surface2/60 p-3">
              <div className="text-xs text-muted">Tarefas concluidas</div>
              <div className="mt-1 font-semibold text-app">{doneTasks}</div>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {studyData.logs.slice(0, 6).map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-app bg-surface2/50 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <div className="truncate text-app">
                    {log.subject || 'Sem materia'} - {formatMinutes(log.minutes)}
                  </div>
                  <div className="text-xs text-muted">
                    {formatDateLabel(log.date)} - {log.source === 'pomodoro' ? 'Pomodoro' : 'Manual'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeFromList('logs', log.id)}
                  className="dash-tab inline-flex h-8 w-8 items-center justify-center rounded-lg border border-app bg-surface text-muted hover:text-app"
                  aria-label="Excluir registro"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {studyData.logs.length === 0 ? (
              <div className="rounded-xl border border-app bg-surface2/50 p-3 text-xs text-muted">
                Nenhum registro ainda.
              </div>
            ) : null}
          </div>
        </section>

        <section className="dash-enter rounded-2xl border border-app bg-surface p-4" style={{ animationDelay: '160ms' }}>
          <div className="flex items-center gap-2 text-sm font-semibold text-app">
            <Goal className="h-4 w-4" />
            Metas de estudo e progresso visual
          </div>

          <form onSubmit={submitGoal} className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
            <input
              value={goalForm.title}
              onChange={(e) => setGoalForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder='Ex: estudar 4h por dia'
              className="h-10 rounded-xl border border-app bg-surface px-3 text-sm text-app placeholder:text-muted md:col-span-2"
            />
            <input
              type="number"
              min={10}
              step={10}
              value={goalForm.targetMinutes}
              onChange={(e) => setGoalForm((prev) => ({ ...prev, targetMinutes: e.target.value }))}
              className="h-10 rounded-xl border border-app bg-surface px-3 text-sm text-app"
            />
            <select
              value={goalForm.period}
              onChange={(e) => setGoalForm((prev) => ({ ...prev, period: e.target.value }))}
              className="h-10 rounded-xl border border-app bg-surface px-3 text-sm text-app"
            >
              <option value="daily">Diaria</option>
              <option value="weekly">Semanal</option>
            </select>
            <input
              value={goalForm.subject}
              onChange={(e) => setGoalForm((prev) => ({ ...prev, subject: e.target.value }))}
              placeholder="Materia (opcional)"
              className="h-10 rounded-xl border border-app bg-surface px-3 text-sm text-app placeholder:text-muted md:col-span-3"
            />
            <button type="submit" className="dash-tab rounded-xl px-3 text-sm btn-primary">
              Nova meta
            </button>
          </form>

          <div className="mt-3 space-y-3">
            {goalsWithProgress.map((goal) => (
              <div key={goal.id} className="rounded-xl border border-app bg-surface2/50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-app">{goal.title}</div>
                    <div className="mt-1 text-xs text-muted">
                      {goal.period === 'daily' ? 'Diaria' : 'Semanal'} - alvo {formatMinutes(goal.targetMinutes)}
                      {goal.subject ? ` - ${goal.subject}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {goal.reached ? <CheckCircle2 className="h-4 w-4 text-app" /> : null}
                    <button
                      type="button"
                      onClick={() => removeFromList('goals', goal.id)}
                      className="dash-tab inline-flex h-8 w-8 items-center justify-center rounded-lg border border-app bg-surface text-muted hover:text-app"
                      aria-label="Excluir meta"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted">
                  <span>{formatMinutes(goal.currentMinutes)}</span>
                  <span>{goal.progress}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface">
                  <div className="dash-progress-value h-full rounded-full bg-(--primary)" style={{ width: `${goal.progress}%` }} />
                </div>
              </div>
            ))}
            {goalsWithProgress.length === 0 ? (
              <div className="rounded-xl border border-app bg-surface2/50 p-3 text-xs text-muted">
                Nenhuma meta criada.
              </div>
            ) : null}
          </div>
        </section>

        <section className="dash-enter rounded-2xl border border-app bg-surface p-4" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center gap-2 text-sm font-semibold text-app">
            <Rocket className="h-4 w-4" />
            Desafios semanais com recompensas
          </div>

          <form onSubmit={submitChallenge} className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
            <input
              value={challengeForm.title}
              onChange={(e) => setChallengeForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Ex: 3h de revisao"
              className="h-10 rounded-xl border border-app bg-surface px-3 text-sm text-app placeholder:text-muted md:col-span-2"
            />
            <input
              type="number"
              min={20}
              step={10}
              value={challengeForm.targetMinutes}
              onChange={(e) => setChallengeForm((prev) => ({ ...prev, targetMinutes: e.target.value }))}
              className="h-10 rounded-xl border border-app bg-surface px-3 text-sm text-app"
            />
            <input
              type="number"
              min={5}
              step={5}
              value={challengeForm.rewardPoints}
              onChange={(e) => setChallengeForm((prev) => ({ ...prev, rewardPoints: e.target.value }))}
              className="h-10 rounded-xl border border-app bg-surface px-3 text-sm text-app"
            />
            <input
              value={challengeForm.subject}
              onChange={(e) => setChallengeForm((prev) => ({ ...prev, subject: e.target.value }))}
              placeholder="Materia (opcional)"
              className="h-10 rounded-xl border border-app bg-surface px-3 text-sm text-app placeholder:text-muted md:col-span-3"
            />
            <button type="submit" className="dash-tab rounded-xl px-3 text-sm btn-primary">
              Criar desafio
            </button>
          </form>

          <div className="mt-3 space-y-3">
            {challengesWithProgress.map((challenge) => (
              <div key={challenge.id} className="rounded-xl border border-app bg-surface2/50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-app">{challenge.title}</div>
                    <div className="mt-1 text-xs text-muted">
                      {challenge.subject ? `${challenge.subject} - ` : ''}
                      alvo {formatMinutes(challenge.targetMinutes)} - recompensa {challenge.rewardPoints} pontos
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {challenge.reached ? <Trophy className="h-4 w-4 text-app" /> : null}
                    <button
                      type="button"
                      onClick={() => removeFromList('challenges', challenge.id)}
                      className="dash-tab inline-flex h-8 w-8 items-center justify-center rounded-lg border border-app bg-surface text-muted hover:text-app"
                      aria-label="Excluir desafio"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted">
                  <span>{formatMinutes(challenge.currentMinutes)}</span>
                  <span>{challenge.progress}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface">
                  <div
                    className="dash-progress-value h-full rounded-full bg-(--primary)"
                    style={{ width: `${challenge.progress}%` }}
                  />
                </div>
              </div>
            ))}
            {challengesWithProgress.length === 0 ? (
              <div className="rounded-xl border border-app bg-surface2/50 p-3 text-xs text-muted">
                Nenhum desafio semanal criado.
              </div>
            ) : null}
          </div>
        </section>

        <section className="dash-enter rounded-2xl border border-app bg-surface p-4" style={{ animationDelay: '240ms' }}>
          <div className="flex items-center gap-2 text-sm font-semibold text-app">
            <CalendarClock className="h-4 w-4" />
            Calendario de provas
          </div>

          <form onSubmit={submitExam} className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
            <input
              value={examForm.title}
              onChange={(e) => setExamForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Nome da prova"
              className="h-10 rounded-xl border border-app bg-surface px-3 text-sm text-app placeholder:text-muted md:col-span-2"
            />
            <input
              value={examForm.subject}
              onChange={(e) => setExamForm((prev) => ({ ...prev, subject: e.target.value }))}
              placeholder="Materia"
              className="h-10 rounded-xl border border-app bg-surface px-3 text-sm text-app placeholder:text-muted"
            />
            <input
              type="date"
              value={examForm.date}
              onChange={(e) => setExamForm((prev) => ({ ...prev, date: e.target.value }))}
              className="h-10 rounded-xl border border-app bg-surface px-3 text-sm text-app"
            />
            <button type="submit" className="dash-tab rounded-xl px-3 text-sm btn-primary md:col-span-4">
              Adicionar prova
            </button>
          </form>

          <div className="mt-3 space-y-2">
            {upcomingExams.map((exam) => {
              const delta = daysUntil(exam.date)
              const isUrgent = delta !== null && delta >= 0 && delta <= 7
              const isLate = delta !== null && delta < 0
              return (
                <div
                  key={exam.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-app bg-surface2/50 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <div className="truncate text-app">
                      {exam.title}
                      {exam.subject ? ` - ${exam.subject}` : ''}
                    </div>
                    <div className="text-xs text-muted">{formatDateLabel(exam.date)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={[
                        'rounded-full border border-app px-2 py-0.5 text-xs',
                        isLate ? 'text-muted' : isUrgent ? 'text-app' : 'text-muted',
                      ].join(' ')}
                    >
                      {isLate
                        ? `Atrasada ${Math.abs(delta)}d`
                        : `Faltam ${delta} dia${delta === 1 ? '' : 's'}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFromList('exams', exam.id)}
                      className="dash-tab inline-flex h-8 w-8 items-center justify-center rounded-lg border border-app bg-surface text-muted hover:text-app"
                      aria-label="Excluir prova"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            })}
            {upcomingExams.length === 0 ? (
              <div className="rounded-xl border border-app bg-surface2/50 p-3 text-xs text-muted">
                Nenhuma prova cadastrada.
              </div>
            ) : null}
          </div>
        </section>

        <section className="dash-enter rounded-2xl border border-app bg-surface p-4" style={{ animationDelay: '280ms' }}>
          <div className="flex items-center gap-2 text-sm font-semibold text-app">
            <Trophy className="h-4 w-4" />
            Ranking de materias
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-app bg-surface2/50 p-3">
              <div className="text-xs uppercase tracking-wide text-muted">Mais estudadas (semana)</div>
              <div className="mt-2 space-y-2">
                {ranking.mostStudied.slice(0, 5).map((item, index) => (
                  <div key={item.subject} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-app">
                      {index + 1}. {item.subject}
                    </span>
                    <span className="text-muted">{formatMinutes(item.minutes)}</span>
                  </div>
                ))}
                {ranking.mostStudied.length === 0 ? (
                  <div className="text-xs text-muted">Sem dados ainda.</div>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border border-app bg-surface2/50 p-3">
              <div className="text-xs uppercase tracking-wide text-muted">Precisa focar mais</div>
              <div className="mt-2 space-y-2">
                {ranking.needsFocus.slice(0, 5).map((item, index) => (
                  <div key={item.subject} className="text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-app">
                        {index + 1}. {item.subject}
                      </span>
                      <span className="text-muted">{item.pendingTasks} pendente(s)</span>
                    </div>
                    <div className="text-xs text-muted">Gap estimado: {Math.round(item.focusNeed)} pts</div>
                  </div>
                ))}
                {ranking.needsFocus.length === 0 ? (
                  <div className="text-xs text-muted">Sem alertas de foco para esta semana.</div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="dash-enter rounded-2xl border border-app bg-surface p-4" style={{ animationDelay: '320ms' }}>
          <div className="flex items-center gap-2 text-sm font-semibold text-app">
            <NotepadText className="h-4 w-4" />
            Anotacoes rapidas por materia
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <select
              value={activeNoteSubject}
              onChange={(e) => setNoteSubject(e.target.value)}
              className="h-10 rounded-xl border border-app bg-surface px-3 text-sm text-app"
            >
              {subjectOptions.length === 0 ? <option value="">Sem materias</option> : null}
              {subjectOptions.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
            <div className="rounded-xl border border-app bg-surface2/50 p-3 text-xs text-muted md:col-span-2">
              Dica: registre formulas, duvidas e links rapidos por materia.
            </div>
            <textarea
              value={studyData.notesBySubject?.[activeNoteSubject] || ''}
              onChange={(e) => updateNote(activeNoteSubject, e.target.value)}
              rows={8}
              placeholder="Escreva suas anotacoes..."
              className="w-full resize-none rounded-xl border border-app bg-surface px-3 py-2 text-sm text-app placeholder:text-muted md:col-span-3"
            />
          </div>
        </section>

        <section className="dash-enter rounded-2xl border border-app bg-surface p-4 xl:col-span-2" style={{ animationDelay: '360ms' }}>
          <div className="flex items-center gap-2 text-sm font-semibold text-app">
            <Medal className="h-4 w-4" />
            Pontos, badges e streaks
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-app bg-surface2/50 p-3">
              <div className="text-xs uppercase tracking-wide text-muted">Pontos totais</div>
              <div className="mt-1 text-2xl font-semibold text-app">{points}</div>
              <div className="mt-2 text-xs text-muted">
                Baseado em tempo estudado, metas, desafios e streak.
              </div>
            </div>

            <div className="rounded-xl border border-app bg-surface2/50 p-3">
              <div className="text-xs uppercase tracking-wide text-muted">Streak atual</div>
              <div className="mt-1 text-2xl font-semibold text-app">{streak.current}</div>
              <div className="mt-2 text-xs text-muted">
                Recorde: {streak.longest} dia{streak.longest === 1 ? '' : 's'}
              </div>
            </div>

            <div className="rounded-xl border border-app bg-surface2/50 p-3">
              <div className="text-xs uppercase tracking-wide text-muted">Ultimo estudo</div>
              <div className="mt-1 text-sm font-semibold text-app">
                {streak.lastDate ? formatDateLabel(streak.lastDate) : 'Sem registros'}
              </div>
              <div className="mt-2 text-xs text-muted">
                Continue hoje para manter sua sequencia.
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-5">
            {badges.map((badge) => (
              <div
                key={badge.id}
                className={[
                  'rounded-xl border p-3 text-center text-xs',
                  badge.unlocked ? 'border-app bg-surface2 text-app' : 'border-app bg-surface text-muted',
                ].join(' ')}
              >
                <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full border border-app">
                  <Trophy className="h-4 w-4" />
                </div>
                <div className="font-medium">{badge.label}</div>
                <div className="mt-1">{badge.unlocked ? 'Desbloqueado' : 'Bloqueado'}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
