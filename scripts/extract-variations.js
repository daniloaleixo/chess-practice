function stripHeaders(pgnText) {
  const lines = pgnText.replace(/\r\n/g, '\n').split('\n')
  let pastHeaders = false
  const body = []
  for (const line of lines) {
    if (!pastHeaders && line.trim().startsWith('[')) continue
    pastHeaders = true
    body.push(line)
  }
  return body.join('\n')
}

function tokenize(body) {
  return body
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\$\d+/g, ' ')
    .replace(/\d+\.{1,3}/g, ' ')
    .replace(/\*|1-0|0-1|1\/2-1\/2/g, ' ')
    .replace(/([()])/g, ' $1 ')
    .split(/\s+/)
    .filter(t => t.length > 0)
}

function walkTokens(tokens, startIdx, prefix) {
  const paths = []
  let path = [...prefix]
  let i = startIdx

  while (i < tokens.length) {
    const tok = tokens[i]
    if (tok === '(') {
      // drop the last move: the variation replaces it
      const varPrefix = path.slice(0, -1)
      const [subPaths, nextI] = walkTokens(tokens, i + 1, varPrefix)
      paths.push(...subPaths)
      i = nextI
    } else if (tok === ')') {
      if (path.length > 0) paths.push(path)
      return [paths, i + 1]
    } else {
      path = [...path, tok]
      i++
    }
  }

  paths.push(path)
  return [paths, i]
}

export function extractAllLeafPaths(pgnText) {
  const body = stripHeaders(pgnText)
  const tokens = tokenize(body)
  if (tokens.length === 0) return []

  const [allPaths] = walkTokens(tokens, 0, [])
  return allPaths.slice(0, -1)
}
