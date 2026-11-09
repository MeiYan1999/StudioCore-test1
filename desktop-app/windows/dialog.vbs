' ====================================================================
' StudioCore Drive — Windows Native Message Box Helper
' ====================================================================
Option Explicit

Dim args, title, message, iconType
Set args = WScript.Arguments

If args.Count >= 2 Then
    title = args(0)
    message = args(1)
    
    ' Support \n for newlines in message
    message = Replace(message, "\n", vbCrLf)
    message = Replace(message, "`n", vbCrLf)
    
    iconType = 64 ' 64 = Information
    If args.Count >= 3 Then
        Select Case LCase(args(2))
            Case "warning"
                iconType = 48
            Case "error"
                iconType = 16
            Case "question"
                iconType = 32
        End Select
    End If
    
    MsgBox message, iconType, title
End If
