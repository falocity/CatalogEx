{{/*
Expand the name of the chart.
*/}}
{{- define "catalogex.name" -}}
{{- default .Chart.Name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Returns the image tag, falling back to the chart's application version.
*/}}
{{- define "catalogex.tag" -}}
{{- default (printf "v%s" .Chart.AppVersion) .Values.image.tag }}
{{- end }}

{{/*
Create a fully qualified application name.
*/}}
{{- define "catalogex.fullname" -}}
{{- $name := default .Chart.Name }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{/*
Create the chart name and version label.
*/}}
{{- define "catalogex.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels, including shared MapColonies metadata.
*/}}
{{- define "catalogex.labels" -}}
helm.sh/chart: {{ include "catalogex.chart" . }}
{{ include "catalogex.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{ include "mclabels.labels" . }}
{{- end }}

{{/*
Selector labels.
*/}}
{{- define "catalogex.selectorLabels" -}}
app.kubernetes.io/name: {{ include "catalogex.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{ include "mclabels.selectorLabels" . }}
{{- end }}

{{/*
Returns the global or local environment, defaulting to development.
*/}}
{{- define "catalogex.environment" -}}
{{- if .Values.global.environment }}
    {{- .Values.global.environment -}}
{{- else -}}
    {{- .Values.environment | default "development" -}}
{{- end -}}
{{- end -}}

{{/*
Returns the global or local cloud provider flavor.
*/}}
{{- define "catalogex.cloudProviderFlavor" -}}
{{- if .Values.global.cloudProvider.flavor }}
    {{- .Values.global.cloudProvider.flavor -}}
{{- else if .Values.cloudProvider -}}
    {{- .Values.cloudProvider.flavor | default "minikube" -}}
{{- else -}}
    {{ "minikube" }}
{{- end -}}
{{- end -}}

{{/*
Returns the global or local Docker registry URL.
*/}}
{{- define "catalogex.cloudProviderDockerRegistryUrl" -}}
{{- if .Values.global.cloudProvider.dockerRegistryUrl }}
    {{- .Values.global.cloudProvider.dockerRegistryUrl -}}
{{- else if .Values.cloudProvider -}}
    {{- .Values.cloudProvider.dockerRegistryUrl -}}
{{- end -}}
{{- end -}}

{{/*
Returns the global or local tracing URL.
*/}}
{{- define "catalogex.tracingUrl" -}}
{{- if .Values.global.tracing.url }}
    {{- .Values.global.tracing.url -}}
{{- else -}}
    {{- .Values.env.tracing.url -}}
{{- end -}}
{{- end -}}
