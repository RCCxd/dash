export function downloadText(filename, text, type = 'application/json; charset=utf-8') {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function downloadJson(filename, dataOrText) {
  const text =
    typeof dataOrText === 'string' ? dataOrText : JSON.stringify(dataOrText ?? {}, null, 2)
  downloadText(filename, text, 'application/json; charset=utf-8')
}

