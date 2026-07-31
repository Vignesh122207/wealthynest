# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# @capacitor/android's own consumer-rules.pro (proguard-rules.pro in node_modules/@capacitor/android)
# keeps every Plugin subclass's *members*, but not the @CapacitorPlugin/@Permission annotation
# *types* themselves - confirmed the hard way: a real release-build crash, reproduced on a real
# emulator right after login (FATAL EXCEPTION: CapacitorPlugins, NullPointerException at
# Bridge.getPermissionStates:1217 - annotation.permissions() where annotation was null), triggered
# by PushNotificationsPlugin.requestPermissions() reading its own class-level @CapacitorPlugin
# annotation via reflection (PluginHandle.getPluginAnnotation()). AGP's default
# proguard-android-optimize.txt already keeps the RuntimeVisibleAnnotations *attribute*, but with
# nothing keeping the annotation *interface classes* themselves from being renamed/removed, R8's
# whole-program optimization stripped them anyway - the debug (unminified) build never reproduced
# this, confirming it's R8-specific, not a plugin logic bug.
-keep class com.getcapacitor.annotation.** { *; }
-keepattributes *Annotation*
