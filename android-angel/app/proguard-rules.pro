# Angel Android Assistant Proguard Rules
-keepattributes *Annotation*
-keepclassmembers class * {
    @androidx.compose.runtime.Composable *;
}
-dontwarn okhttp3.**
-dontwarn okio.**
