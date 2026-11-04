import * as vscode from 'vscode'

export async function runVisibleTask(
  name: string,
  commandLine: string,
  cwd?: string
): Promise<void> {
  const task = createShellTask(name, commandLine, cwd)
  await waitForTask(task, name)
}

function createShellTask(name: string, commandLine: string, cwd?: string): vscode.Task {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
  const task = new vscode.Task(
    { type: 'shell', task: commandLine },
    workspaceFolder || vscode.TaskScope.Workspace,
    `Air Flutter - ${name}`,
    'Air Flutter',
    new vscode.ShellExecution(commandLine, cwd ? { cwd } : undefined)
  )
  task.presentationOptions = {
    reveal: vscode.TaskRevealKind.Always,
    panel: vscode.TaskPanelKind.Dedicated,
    clear: true
  }
  return task
}

async function waitForTask(task: vscode.Task, name: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let execution: vscode.TaskExecution | undefined
    const subscription = vscode.tasks.onDidEndTaskProcess(event => {
      if (!execution || event.execution !== execution) return
      subscription.dispose()
      if (event.exitCode === 0) resolve()
      else reject(new Error(`${name} failed with exit code ${event.exitCode ?? 'unknown'}.`))
    })
    vscode.tasks.executeTask(task).then(
      started => { execution = started },
      error => {
        subscription.dispose()
        reject(error)
      }
    )
  })
}
