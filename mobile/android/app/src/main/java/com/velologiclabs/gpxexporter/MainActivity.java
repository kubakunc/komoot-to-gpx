package com.velologiclabs.gpxexporter;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(KomootAuthPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
