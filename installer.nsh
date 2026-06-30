!macro customInstall
  ExecWait 'netsh advfirewall firewall add rule name="Adestio Blockchain P2P" dir=in action=allow protocol=TCP localport=34567,34568'
  ExecWait 'netsh advfirewall firewall add rule name="Adestio Blockchain P2P UDP" dir=in action=allow protocol=UDP localport=34567,34568'
!macroend

!macro customUnInstall
  ExecWait 'netsh advfirewall firewall delete rule name="Adestio Blockchain P2P"'
  ExecWait 'netsh advfirewall firewall delete rule name="Adestio Blockchain P2P UDP"'
!macroend
