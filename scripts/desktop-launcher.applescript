property bundleDisplayName : "上帝工作台"
property projectPath : "/Users/yuchao/Documents/GitHub/god-workbench"
property devPort : "43174"
property workbenchPath : "/"
property logFile : "/tmp/god_workbench_dev.log"
property readySeconds : 45
property supabaseUrl : "https://pwbbimvwfrpljjjdzmbn.supabase.co"
property supabasePublishableKey : "sb_publishable_nmamNaOfvCIgJH_0X5oYfg_fr-iv5Q7"
property documentId : "default"
property launchLabel : "local.god-workbench.dev"

on run
	set openURL to "http://localhost:" & devPort & workbenchPath
	set refreshURL to openURL & "?launcherRefresh=" & (do shell script "date +%s")
	set qProjectPath to quoted form of projectPath
	set qLogFile to quoted form of logFile
	set qNodeModules to quoted form of (projectPath & "/node_modules")
	
	set header to "===== " & bundleDisplayName & " " & ((current date) as string) & " ====="
	try
		do shell script "/bin/zsh -lic " & quoted form of ("printf '%s\\n' " & quoted form of header & " >> " & qLogFile)
	end try
	
	display notification "正在检查项目与依赖…" with title bundleDisplayName
	
	set depState to "unknown"
	try
		set depState to do shell script "/bin/zsh -lic " & quoted form of ("[ -d " & qNodeModules & " ] && echo installed || echo missing")
	end try
	
	if depState is "missing" then
		display dialog "未检测到 node_modules，请先在项目目录运行 npm install。" buttons {"好"} default button 1 with title bundleDisplayName with icon caution
		return
	end if
	
	display notification "正在启动上帝工作台（端口 " & devPort & "）…" with title bundleDisplayName
	
	try
		do shell script "/bin/zsh -lic " & quoted form of (my buildStartCommand(qProjectPath, qLogFile))
	on error errMsg number errNum
		display dialog "启动失败：" & return & return & errMsg & " (" & errNum & ")" & return & return & "日志：" & logFile buttons {"好"} default button 1 with title bundleDisplayName with icon stop
		return
	end try
	
	set webReady to false
	repeat with i from 1 to readySeconds
		try
			set pageBody to do shell script "/bin/zsh -lic " & quoted form of ("curl -fsS --connect-timeout 1 --max-time 2 " & quoted form of openURL)
			if pageBody contains "上帝工作台" or pageBody contains "God Workbench" then
				set webReady to true
				exit repeat
			end if
		end try
		delay 1
	end repeat
	
	if webReady then
		try
			do shell script "/bin/zsh -lic " & quoted form of ("open " & quoted form of refreshURL)
		end try
		display notification "上帝工作台已就绪" with title bundleDisplayName
	else
		display dialog "在 " & readySeconds & " 秒内未能检测到服务就绪：" & return & openURL & return & return & "日志：" & logFile buttons {"好"} default button 1 with title bundleDisplayName with icon caution
	end if
end run

on buildStartCommand(qProjectPath, qLogFile)
	set qOpenURL to quoted form of ("http://localhost:" & devPort & workbenchPath)
	set envVars to "VITE_SUPABASE_URL=" & quoted form of supabaseUrl & " VITE_SUPABASE_PUBLISHABLE_KEY=" & quoted form of supabasePublishableKey & " VITE_GOD_WORKBENCH_DOCUMENT_ID=" & quoted form of documentId
	set launchCommand to "cd " & qProjectPath & " && env " & envVars & " npm run dev -- --strictPort"
	return "if curl -fsS --connect-timeout 1 --max-time 2 " & qOpenURL & " 2>/dev/null | grep -q '上帝工作台\\|God Workbench'; then " & ¬
		"printf '%s\\n' 'reuse existing god-workbench dev server on " & devPort & "' >> " & qLogFile & "; " & ¬
		"else existingPids=$(/usr/sbin/lsof -tiTCP:" & devPort & " -sTCP:LISTEN 2>/dev/null || true); " & ¬
		"if [ -n \"$existingPids\" ]; then printf '%s\\n' 'port " & devPort & " is occupied by another process' >> " & qLogFile & "; exit 2; fi; " & ¬
		"/bin/launchctl remove " & launchLabel & " >/dev/null 2>&1 || true; " & ¬
		"/bin/launchctl submit -l " & launchLabel & " -o " & qLogFile & " -e " & qLogFile & " -- /bin/zsh -lc " & quoted form of launchCommand & "; fi"
end buildStartCommand
