const skillFactor = /^(.+?): уровень (\d+), требование (\d+), gap (\d+), ожидаемый прирост \+(\d+)(?: \(критический для следующего grade\))?\.$/
const historyFactor = /^Прошлые попытки этого event \((.+)\): история -?\d+(?:\.\d+)? балла\.$/

const statusNames: Record<string, string> = {
  no_show: 'неявка',
  dropped: 'прервано',
  declined: 'отказ'
}

function explain(factor: string, nextGrade?: string, compact = false): string[] {
  const skill = factor.match(skillFactor)
  if (skill) {
    const [, name, currentText, requiredText, gapText, gainText] = skill
    const current = Number(currentText)
    const required = Number(requiredText)
    const gap = Number(gapText)
    const gain = Number(gainText)
    if (compact) return [`${name}: сейчас ${current}, для ${nextGrade ?? 'следующего грейда'} нужно ${required}; дефицит ${gap}, ожидаемый прирост +${gain}.`]
    return [
      nextGrade ? `Для перехода на ${nextGrade} требуется ${name} уровня ${required}.` : `Требуется ${name} уровня ${required}.`,
      `Сейчас ваш уровень — ${current}; дефицит — ${gap}.`,
      `Эта активность даёт +${gain} к ${name}.`,
      ...(gap > 0 && current + gain >= required ? [`После прохождения требование по ${name} будет выполнено.`] : [])
    ]
  }

  const history = factor.match(historyFactor)
  if (history) {
    const attempts = history[1].split(', ').map(part => {
      const [status, count] = part.split(': ')
      return statusNames[status] && /^\d+$/.test(count) ? `${statusNames[status]}: ${count}` : part
    })
    return [`При оценке учтены прошлые попытки этой активности (${attempts.join(', ')}).`]
  }

  return [factor]
}

export function RecommendationReasons({ factors, nextGrade, compact = false }: { factors: string[]; nextGrade?: string; compact?: boolean }) {
  if (factors.length === 0) return <p>Сервер не предоставил объяснение.</p>
  return <ul>{factors.flatMap(factor => explain(factor, nextGrade, compact)).map((reason, index) => <li key={index}>{reason}</li>)}</ul>
}
