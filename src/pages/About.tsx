/* eslint-disable react/prop-types */
import React, { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import Logo from '../../src-tauri/icons/128x128.png';
import { useCheckUpdate } from '../hooks/useCheckUpdate';
import { useAppStateStore } from '../stores/app-state';
import { isVersionGt } from '../utils/version';
import { dialog } from '@tauri-apps/api';

export const About: React.FC = () => {
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const checkForUpdate = useCheckUpdate();
  const { latestVersion, latestUrl } = useAppStateStore((s) => ({
    latestVersion: s.latestVersion,
    latestUrl: s.latestUrl,
  }));

  return (
    <>
      <PageHeader />
      <div className="space-y-6">
        <section className="flex items-center">
          <img src={Logo} className="w-28" alt="logo" />
          <span className="text-5xl ml-4 font-bold">X-Spider</span>
        </section>
        
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <ul className="space-y-4 text-lg">
            <li className="flex items-center gap-2">
              <strong className="min-w-24">版本号：</strong>
              <span>{PACKAGE_JSON_VERSION}</span>
              {isVersionGt(latestVersion, PACKAGE_JSON_VERSION) && (
                <span className="ml-2">
                  &nbsp;→&nbsp;
                  <a
                    className="text-blue-600 hover:text-blue-800 font-medium underline"
                    href={latestUrl}
                    target="_blank"
                    rel="noreferrer"
                    title="前往下载"
                  >
                    {latestVersion}
                  </a>
                </span>
              )}
              &nbsp;（
              <button
                onClick={async () => {
                  setIsCheckingUpdate(true);
                  try {
                    const hasUpdate = await checkForUpdate();
                    if (!hasUpdate) {
                      dialog.message('软件已是最新版本', {
                        title: '软件已是最新版本',
                      });
                    }
                  } catch (err) {
                    console.error(err);
                    dialog.message('无法获取最新更新，请稍后再试', {
                      title: '获取更新错误',
                    });
                  } finally {
                    setIsCheckingUpdate(false);
                  }
                }}
                className="text-blue-600 hover:text-blue-800 hover:underline disabled:text-gray-400 disabled:hover:no-underline"
                disabled={isCheckingUpdate}
              >
                {isCheckingUpdate ? '请稍候...' : '检查更新'}
              </button>
              ）
            </li>
            
            <li className="flex items-center gap-2">
              <strong className="min-w-24">原作者：</strong>
              <a
                href="https://github.com/MiningCattiva"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:text-blue-800 hover:underline"
              >
                MiningCattiva
              </a>
            </li>
            
            <li className="flex items-center gap-2">
              <strong className="min-w-24">修改者：</strong>
              <a
                href="https://github.com/hureyqi"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:text-blue-800 hover:underline"
              >
                hureyqi
              </a>
            </li>
            
            <li className="flex items-center gap-2">
              <strong className="min-w-24">仓库地址：</strong>
              <a
                href="https://github.com/hureyqi/x-spider-mod-2026"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:text-blue-800 hover:underline break-all"
              >
                https://github.com/hureyqi/x-spider-mod-2026
              </a>
            </li>
            
            <li className="flex items-center gap-2">
              <strong className="min-w-24">开源协议：</strong>
              <a
                href="https://github.com/hureyqi/x-spider-mod-2026/blob/master/LICENSE"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:text-blue-800 hover:underline"
              >
                GPL-3.0-only
              </a>
            </li>
            
            <li className="flex flex-col">
              <strong className="min-w-24">软件说明：</strong>
              <div className="mt-2 text-sm text-gray-600 space-y-1">
                <p>本项目为个人学习修改版</p>
                <p>本项目仅用于学习交流，请勿用于商业或非法用途。</p>
                <p>代理地址本机一般是 http://127.0.0.1:这里填写你的代理软件端口</p>
                <p>代理软件要打开http代理并确定端口</p>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </>
  );
};
