import { useMyPoints, useLeaderboard, useActivities, useCompleteActivity } from '@/api/gamification'
import { PageLoader } from '@/components/ui/Spinner'
import { Avatar } from '@/components/ui/Avatar'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/utils/cn'
import { timeAgo } from '@/utils/formatters'
import { Trophy, Award, Star, Rocket, Brain, TrendingUp, Zap, Target, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from '@/store/toastStore'

const BADGE_ICONS: Record<string, React.ElementType> = {
  rocket: Rocket, brain: Brain, star: Star,
  'trending-up': TrendingUp, award: Award, trophy: Trophy,
}

const REASON_LABELS: Record<string, string> = {
  quiz_completed: 'Quiz Completed',
  perfect_score: 'Perfect Score',
  lesson_viewed: 'Lesson Viewed',
  streak_7_days: '7-Day Streak',
  first_submission: 'First Submission',
  activity_completed: 'Activity Completed',
}

export function GamificationPage() {
  const { user } = useAuth()
  const { data: points, isLoading: ptsLoading } = useMyPoints()
  const { data: leaderboard, isLoading: lbLoading } = useLeaderboard()
  const { data: activities, isLoading: actLoading } = useActivities()
  const completeMutation = useCompleteActivity()

  const handleComplete = async (id: string, title: string, pointsReward: number) => {
    try {
      await completeMutation.mutateAsync(id)
      toast.success(`+${pointsReward} pts — ${title}`)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? 'Could not complete activity')
    }
  }

  if (ptsLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-ink font-display">Achievements & Leaderboard</h2>

      {/* Points banner */}
      {points && (
        <div
          className="rounded-2xl p-6 text-ink relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #111318 0%, #1a1508 60%, #2a1a05 100%)' }}
        >
          <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-amber-500/[0.08] blur-[80px] pointer-events-none" />
          <div className="relative flex items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-amber-500/15 flex items-center justify-center">
              <Zap className="w-10 h-10 text-amber-400" />
            </div>
            <div>
              <p className="text-amber-400 text-xs font-semibold uppercase tracking-widest font-display">Total Points</p>
              <p className="text-4xl font-bold mt-1 font-display">{points.total_points}</p>
              <p className="text-ink-secondary text-sm mt-1">{points.badges.length} badge{points.badges.length !== 1 ? 's' : ''} earned</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left column: Activities, Badges, Recent */}
        <div className="xl:col-span-2 space-y-6">
          {/* Activities */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink flex items-center gap-2 font-display">
                <Target className="w-4 h-4 text-primary-400" /> Available Activities
              </h3>
              {activities && activities.length > 0 && (
                <span className="text-[11px] text-ink-muted">
                  {activities.filter((a) => !a.completed).length} open
                </span>
              )}
            </div>
            {actLoading ? (
              <div className="py-6"><PageLoader /></div>
            ) : !activities?.length ? (
              <p className="px-5 py-8 text-center text-ink-muted text-sm">
                No activities available yet. Check back soon!
              </p>
            ) : (
              <div className="divide-y divide-border/60">
                {activities.map((a) => {
                  const isPending = completeMutation.isPending && completeMutation.variables === a.id
                  return (
                    <div key={a.id} className="px-5 py-4 flex items-start gap-4">
                      <div className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                        a.completed ? 'bg-emerald-500/15' : 'bg-primary-500/15',
                      )}>
                        {a.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <Target className="w-5 h-5 text-primary-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-ink">{a.title}</p>
                            <p className="text-xs text-ink-muted leading-snug mt-0.5">{a.description}</p>
                            <div className="mt-2 flex items-center gap-3 text-[11px] text-ink-faint">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-elevated border border-border">
                                {a.category}
                              </span>
                              <span className="inline-flex items-center gap-1 text-amber-400 font-semibold">
                                <Zap className="w-3 h-3" /> +{a.points} pts
                              </span>
                              {a.completed && a.completed_at && (
                                <span>Completed {timeAgo(a.completed_at)}</span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={a.completed || isPending}
                            onClick={() => handleComplete(a.id, a.title, a.points)}
                            className={cn(
                              'shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                              a.completed
                                ? 'bg-emerald-500/15 text-emerald-400 cursor-default'
                                : 'btn-primary',
                            )}
                          >
                            {isPending ? (
                              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving</>
                            ) : a.completed ? (
                              <>Completed</>
                            ) : (
                              <>Mark complete</>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Badges */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-ink flex items-center gap-2 font-display">
                <Award className="w-4 h-4 text-primary-400" /> My Badges
              </h3>
            </div>
            {!points?.badges.length ? (
              <p className="px-5 py-8 text-center text-ink-muted text-sm">No badges yet. Keep learning to earn badges!</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-5">
                {points.badges.map((ub) => {
                  const Icon = BADGE_ICONS[ub.badge.icon] || Award
                  return (
                    <div key={ub.id} className="flex items-start gap-3 p-3 rounded-xl bg-surface-elevated border border-border">
                      <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-amber-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink">{ub.badge.name}</p>
                        <p className="text-xs text-ink-muted leading-tight mt-0.5">{ub.badge.description}</p>
                        <p className="text-[10px] text-ink-faint mt-1">{timeAgo(ub.earned_at)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Recent points */}
          {points && points.recent_points.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-ink font-display">Recent Activity</h3>
              </div>
              <div className="divide-y divide-border/60">
                {points.recent_points.slice(0, 10).map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center">
                        <Zap className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm text-ink">{REASON_LABELS[p.reason] || p.reason}</p>
                        <p className="text-xs text-ink-muted">{timeAgo(p.created_at)}</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-emerald-400">+{p.points}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Leaderboard */}
        <div className="card overflow-hidden h-fit">
          <div className="px-5 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2 font-display">
              <Trophy className="w-4 h-4 text-amber-400" /> Leaderboard
            </h3>
          </div>
          {lbLoading ? <PageLoader /> : !leaderboard?.length ? (
            <p className="px-5 py-8 text-center text-ink-muted text-sm">No data yet</p>
          ) : (
            <div className="divide-y divide-border/60">
              {leaderboard.map((entry) => (
                <div
                  key={entry.student_id}
                  className={cn(
                    'flex items-center gap-3 px-5 py-3',
                    entry.student_id === user?.id && 'bg-primary-500/[0.05]'
                  )}
                >
                  <span className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                    entry.rank === 1 ? 'bg-amber-500/20 text-amber-400' :
                    entry.rank === 2 ? 'bg-slate-400/30 text-slate-700 dark:text-slate-200' :
                    entry.rank === 3 ? 'bg-orange-500/20 text-orange-400' :
                    'bg-surface-elevated text-ink-muted'
                  )}>
                    {entry.rank}
                  </span>
                  <Avatar name={entry.student_name} src={entry.avatar_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink font-medium truncate">{entry.student_name}</p>
                    <p className="text-[10px] text-ink-muted">{entry.badge_count} badge{entry.badge_count !== 1 ? 's' : ''}</p>
                  </div>
                  <span className="text-sm font-bold text-amber-400">{entry.total_points}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
