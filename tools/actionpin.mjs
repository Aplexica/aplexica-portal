// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const pinned = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_./-]+@[0-9a-f]{40}(?:\s+#.*)?$/
let bad = false
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const file = join(dir, name)
    if (statSync(file).isDirectory()) { walk(file); continue }
    if (!/\.ya?ml$/.test(file)) continue
    const source = readFileSync(file, 'utf8')
    source.split(/\r?\n/).forEach((line, i) => {
      const text = line.trim().replace(/^-\s*/, '')
      if (!text.startsWith('uses:')) return
      const value = text.slice(5).trim()
      if (!value.startsWith('./') && !pinned.test(value)) {
        process.stderr.write(`${file}:${i + 1}: mutable action ${JSON.stringify(value)}\n`); bad = true
      }
    })
    const pullRequest = /^[ ]{2}pull_request:\s*$/m.test(source)
    const pullRequestTarget = /^[ ]{2}pull_request_target:\s*$/m.test(source)
    const issueComment = /^[ ]{2}issue_comment:\s*$/m.test(source)
    const untrusted = pullRequest || pullRequestTarget || issueComment
    if (untrusted && /runs-on:\s*(?:\[[^\]]*self-hosted|self-hosted)/i.test(source)) {
      process.stderr.write(`${file}: untrusted trigger reaches self-hosted runner\n`); bad = true
    }
    if (pullRequestTarget && /uses:\s*actions\/checkout@/.test(source)) {
      process.stderr.write(`${file}: pull_request_target checks out contributor-controlled code\n`); bad = true
    }
    if (pullRequest && /\$\{\{\s*secrets\./.test(source)) {
      process.stderr.write(`${file}: pull_request job references a secret\n`); bad = true
    }
    const workflowPermissions = source.match(/^permissions:\s*\n((?:^[ \t]+.*\n?)*)/m)?.[1] ?? ''
    if (untrusted && /:\s*write\s*$/m.test(workflowPermissions)) {
      process.stderr.write(`${file}: untrusted workflow has workflow-level write permission\n`); bad = true
    }
  }
}
walk('.github')
if (bad) process.exit(1)
