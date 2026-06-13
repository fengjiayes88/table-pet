' 七七桌宠静默启动脚本（无命令行窗口闪烁）
On Error Resume Next

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' 项目根目录 = vbs 所在目录
projectDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = projectDir

' Electron 可执行文件路径（项目本地）
electronExe = projectDir & "\node_modules\electron\dist\electron.exe"

If fso.FileExists(electronExe) Then
    ' 直接调用本地 electron.exe，避开 PATH 和 npm 依赖
    WshShell.Run """" & electronExe & """ """ & projectDir & """", 0, False
Else
    ' 退回 npm 启动（要求 PATH 中能找到 npm）
    WshShell.Run "cmd /c npm start", 0, False
End If
