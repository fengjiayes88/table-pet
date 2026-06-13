' Qixi pet silent launcher (no console flicker)
On Error Resume Next

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Project root = directory of this vbs
projectDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = projectDir

' Local Electron executable path
electronExe = projectDir & "\node_modules\electron\dist\electron.exe"

If fso.FileExists(electronExe) Then
    ' Use bundled electron.exe directly, avoid PATH and npm dependency
    WshShell.Run """" & electronExe & """ """ & projectDir & """", 0, False
Else
    ' Fallback to npm start (requires npm in PATH)
    WshShell.Run "cmd /c npm start", 0, False
End If
