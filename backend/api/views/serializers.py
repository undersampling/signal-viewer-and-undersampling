from rest_framework import serializers

class SignalUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    signal_type = serializers.CharField(max_length=10)

class WFDBUploadSerializer(serializers.Serializer):
    dat_file = serializers.FileField()
    hea_file = serializers.FileField()
    signal_type = serializers.CharField(max_length=10)

class SignalGraphSerializer(serializers.Serializer):
    data = serializers.ListField()
    fs = serializers.IntegerField()
    channels = serializers.ListField()
    viewer_type = serializers.CharField()
    position = serializers.FloatField()
    zoom = serializers.FloatField()
    chunk_duration = serializers.FloatField(required=False)
    colormap = serializers.CharField(required=False)
    polar_mode = serializers.CharField(required=False)
    rec_ch_x = serializers.IntegerField(required=False)
    rec_ch_y = serializers.IntegerField(required=False)
    undersample_freq = serializers.IntegerField(required=False, allow_null=True, default=None)  # NEW: Nyquist undersampling