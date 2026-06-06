import { PropsWithChildren, ReactNode, createContext, useContext } from 'react';
import { SettingFilled } from '@ant-design/icons';
import { useTheme } from '../../App';

export interface SectionProps extends PropsWithChildren {
  title: string;
  name: string;
  titleIcon?: ReactNode;
}

const context = createContext<Pick<SectionProps, 'name'>>({
  name: '',
});

export const Section: React.FC<SectionProps> = ({
  name,
  title,
  children,
  titleIcon = <SettingFilled />,
}) => {
  const { isDark } = useTheme();

  return (
    <context.Provider value={{ name }}>
      <section
        className="mb-4 p-5 rounded-xl"
        aria-label={title}
        style={{
          backgroundColor: isDark ? '#1c1c1e' : '#ffffff',
          border: isDark
            ? '1px solid rgba(255,255,255,0.08)'
            : '1px solid rgba(0,0,0,0.06)',
          boxShadow: isDark
            ? '0 1px 3px rgba(0,0,0,0.3)'
            : '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
        }}
      >
        <h2
          className="font-semibold text-base mb-5 flex items-center"
          style={{ color: isDark ? '#f5f5f7' : '#1d1d1f' }}
        >
          <span
            style={{
              color: 'var(--ant-color-primary)',
              transform: 'translateY(1px)',
            }}
            aria-hidden
          >
            {titleIcon}
          </span>
          <span className="ml-2">{title}</span>
        </h2>
        {children}
      </section>
    </context.Provider>
  );
};

export function useSectionContext() {
  return useContext(context);
}
