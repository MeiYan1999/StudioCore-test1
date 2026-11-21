Option Explicit
Dim shell, args, command, i
Set shell = CreateObject("WScript.Shell")
Set args = WScript.Arguments
command = ""
For i = 0 To args.Count - 1
  command = command & " " & Quote(args(i))
Next
shell.Run Trim(command), 0, False
Function Quote(value)
  Dim result, c, count, j, k
  result = Chr(34)
  count = 0
  For j = 1 To Len(value)
    c = Mid(value, j, 1)
    If c = "\" Then
      count = count + 1
    Else
      If c = Chr(34) Then
        For k = 1 To count * 2 + 1
          result = result & "\"
        Next
      Else
        For k = 1 To count
          result = result & "\"
        Next
      End If
      result = result & c
      count = 0
    End If
  Next
  For k = 1 To count * 2
    result = result & "\"
  Next
  Quote = result & Chr(34)
End Function
